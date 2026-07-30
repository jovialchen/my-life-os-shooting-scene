"""岛屿花园：起伏地形 + 绕屋石板环路 + 草丛/应季花卉 + 15 棵季节树 + 雪人。

坐标约定：Blender(x, y, z) → three.js(x, z, -y)，three.js Y 轴朝上。
岛中心 Blender (0, -5)，半径 25，顶面基准 z=TOP_Z=-0.02（对齐旧草地）。
房子 footprint：Blender x±12, y∈[-4,+6]；房子地面在 TOP_Z，
其周边 2m 内地形压平并平滑过渡到起伏区。

导航约束（js/character/pathfinding.js）：
  - 相邻格(0.1m)高差 ≤0.35 可通行 → 地形只做低频平缓起伏（坡度 ≤13%）
  - 高出地面 <0.15m(STEP_TOL) 的障碍顶点不挡路 → 石板顶面只高出 0.03
  - 草丛/花丛/雪人高于 0.15 会挡路 → 标 nav_ignore=True，surfaceParser 跳过

季节系统数据约定（js/systems/seasons.js 读取 GLB extras）：
  - TREE_XX_leaves:  season_leaves=True, tree_type='deciduous'|'pine',
                     leaf_spring/leaf_autumn（落叶树，hex 字符串）
  - TREE_XX_fruits:  season_fruits=True（落叶树，材质即果子颜色，秋季显现）
  - TREE_XX_snow:    season_snow=True（雪盖，冬季显现）
  - SNOWMAN:         season_snowman=True + nav_ignore（冬季显现）
  - FLOWERS_<种>:    flower_bloom_in/out（季节值 0~3 的花期窗口，透明度淡入淡出）

花期参考（3-5春 6-8夏 9-11秋 12-2冬）：郁金香=春，绣球/薰衣草/向日葵=夏，
波斯菊=夏秋，菊花=秋，腊梅=冬。

产物：
  models_src/island.blend
  models/island.glb（glTF Binary，apply modifiers，export_extras=True）

用法:
  tools/blender.sh -b --python tools/make_island.py
"""
import math
import os
import random

import bmesh
import bpy
from mathutils import Matrix, Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BLEND_OUT = os.path.join(ROOT, 'models_src', 'island.blend')
GLB_OUT = os.path.join(ROOT, 'models', 'island.glb')

# ── 岛屿参数 ──
CENTER_X = 0.0
CENTER_Y = -5.0
TOP_Z = -0.02
RADIUS = 25.0
SKIRT_SEGMENTS = 18   # 裙边低多边形

# 房子 footprint（Blender 坐标）
HOUSE_X = 12.0
HOUSE_Y0 = -4.0
HOUSE_Y1 = 6.0

# 顶面网格（起伏载体）
TOP_SEGMENTS = 48
TOP_RADII = [2.5 * i for i in range(1, 11)]   # 2.5 … 25

# ── 15 棵树：落叶树 9（春花/秋果各异）+ 松树 6（常青）──
# (key, x, y, seed, 类型, 春花, 秋叶, 秋果)；春花/果只用于落叶树
# 春花：粉/深粉/白；秋果：深紫/红/橙——同一棵树只有一种果子
PINK, DPINK, WHITE = '#f2a7c3', '#e56b9f', '#f5f2ea'
PURPLE, RED, ORANGE = '#5a3a6e', '#c93a3a', '#e08a30'
AUT_PALETTE = ['#c9562e', '#d09a3a', '#b84a3a', '#d07a2a']   # 秋叶 palette

TREES = [
    ('TREE_01', -18.0,  -6.0, 101, 'deciduous', PINK,  AUT_PALETTE[0], RED),
    ('TREE_02',  17.0,  -8.0, 202, 'deciduous', DPINK, AUT_PALETTE[1], PURPLE),
    ('TREE_03',  -3.0, -21.0, 303, 'deciduous', WHITE, AUT_PALETTE[2], ORANGE),
    ('TREE_04', -16.0,  10.0, 404, 'deciduous', PINK,  AUT_PALETTE[3], PURPLE),
    ('TREE_05',  17.0,   9.0, 505, 'deciduous', DPINK, AUT_PALETTE[0], RED),
    ('TREE_06', -10.0, -14.0, 606, 'deciduous', WHITE, AUT_PALETTE[1], PURPLE),
    ('TREE_07',  10.0, -16.0, 707, 'deciduous', PINK,  AUT_PALETTE[2], ORANGE),
    ('TREE_08',  -8.0,  13.0, 808, 'deciduous', DPINK, AUT_PALETTE[3], ORANGE),
    ('TREE_09',   6.0,  14.0, 909, 'deciduous', WHITE, AUT_PALETTE[0], RED),
    ('TREE_10', -20.0, -12.0, 111, 'pine', None, None, None),
    ('TREE_11',  20.0,  -2.0, 222, 'pine', None, None, None),
    ('TREE_12',  20.0,   5.0, 333, 'pine', None, None, None),
    ('TREE_13', -20.0,   3.0, 444, 'pine', None, None, None),
    ('TREE_14',  12.0, -22.0, 555, 'pine', None, None, None),
    ('TREE_15', -12.0, -22.0, 666, 'pine', None, None, None),
]

# 雪人位置（南侧草坪，避开门廊支路）
SNOWMAN_POS = (5.0, -12.0)

# ── 应季花卉（花期窗口为季节值 0~3：0春 1夏 2秋 3冬）──
# (mesh 名, 花色列表, bloom_in, bloom_out, 数量, 茎高范围, 花头半径范围)
FLOWER_SPECIES = [
    ('FLOWERS_tulip',      ['#e58fb1', '#d95f5f', '#e8c94f'], -0.2, 0.95, 40, (0.16, 0.24), (0.06, 0.09)),
    ('FLOWERS_hydrangea',  ['#7a9ee0', '#e5a7c8'],            0.75, 1.6,  30, (0.18, 0.26), (0.10, 0.14)),
    ('FLOWERS_lavender',   ['#8a7ed0', '#6a9ad0'],            0.9,  1.8,  35, (0.22, 0.30), (0.04, 0.06)),
    ('FLOWERS_sunflower',  ['#e8b83a'],                       1.1,  1.9,  25, (0.30, 0.40), (0.10, 0.14)),
    ('FLOWERS_cosmos',     ['#e58fb1', '#f2efe6', '#d95f5f'], 1.3,  2.4,  35, (0.20, 0.28), (0.06, 0.09)),
    ('FLOWERS_mum',        ['#e8b83a', '#d95f5f', '#e08a30'], 1.9,  2.8,  30, (0.16, 0.24), (0.07, 0.10)),
    ('FLOWERS_wintersweet', ['#e8c94f'],                      2.55, 3.4,  20, (0.14, 0.20), (0.05, 0.07)),
]


# ── 材质（复用 flat_materials 的平涂做法）──
def hex_to_linear(hex_str):
    h = hex_str.lstrip('#')
    srgb = [int(h[i:i+2], 16) / 255.0 for i in (0, 2, 4)]

    def to_linear(c):
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    return tuple(to_linear(c) for c in srgb) + (1.0,)


def make_flat_material(name, hex_color):
    """纯色平涂：Roughness=1, Metallic=0, Specular=0（NPR 规范）。"""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    h = hex_color.lstrip('#')
    mat.diffuse_color = tuple(int(h[i:i+2], 16) / 255.0
                              for i in (0, 2, 4)) + (1.0,)
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Base Color'].default_value = hex_to_linear(hex_color)
    bsdf.inputs['Roughness'].default_value = 1.0
    bsdf.inputs['Metallic'].default_value = 0.0
    spec = bsdf.inputs.get('Specular IOR Level') or bsdf.inputs.get('Specular')
    if spec:
        spec.default_value = 0.0
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    return mat


def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.cameras,
                  bpy.data.lights):
        for item in list(block):
            block.remove(item)


def smoothstep(t):
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


# ── 地形起伏 ──
def dist_house(x, y):
    """到房子矩形外的距离（矩形内为 0）。"""
    dx = max(0.0, abs(x) - HOUSE_X)
    dy = max(0.0, max(y - HOUSE_Y1, HOUSE_Y0 - y))
    return math.hypot(dx, dy)


def terrain_h(x, y):
    """起伏高度：低频正弦叠加（最大坡度约 13%），房子周边与岛缘压平。"""
    raw = (0.18 * math.sin(x * 0.35 + 1.7) * math.cos(y * 0.28 - 0.6)
           + 0.12 * math.sin((x + y) * 0.21 + 0.4)
           + 0.08 * math.cos(x * 0.12 - y * 0.17 + 2.0))
    f_house = smoothstep((dist_house(x, y) - 2.0) / 3.0)   # 房外 2m→5m 过渡
    dc = math.hypot(x - CENTER_X, y - CENTER_Y)
    f_rim = 1.0 - smoothstep((dc - 21.5) / 3.0)            # 岛缘 21.5→24.5 过渡
    return raw * f_house * f_rim


def top_grid_geometry(z_offset=0.0):
    """同心环顶面网格（含起伏），法线朝上。返回 (verts, faces)。"""
    verts = [(CENTER_X, CENTER_Y,
              TOP_Z + z_offset + terrain_h(CENTER_X, CENTER_Y))]
    for r in TOP_RADII:
        for i in range(TOP_SEGMENTS):
            a = 2 * math.pi * i / TOP_SEGMENTS
            x = CENTER_X + r * math.cos(a)
            y = CENTER_Y + r * math.sin(a)
            verts.append((x, y, TOP_Z + z_offset + terrain_h(x, y)))
    faces = []
    for i in range(TOP_SEGMENTS):           # 中心扇面
        j = (i + 1) % TOP_SEGMENTS
        faces.append((0, 1 + i, 1 + j))
    for k in range(len(TOP_RADII) - 1):     # 环间四边形
        s0 = 1 + k * TOP_SEGMENTS
        s1 = s0 + TOP_SEGMENTS
        for i in range(TOP_SEGMENTS):
            j = (i + 1) % TOP_SEGMENTS
            faces.append((s0 + i, s1 + i, s1 + j, s0 + j))
    return verts, faces


def jitter(i, seed, amp):
    """确定性的径向抖动，让裙边有岩石感。"""
    return 1.0 + amp * math.sin(i * 2.3 + seed) * math.cos(i * 0.7 + seed * 2)


def link_object(name, verts, faces, materials, face_mats=None):
    """从顶点/面列表建 mesh + object 并放入场景。"""
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    for m in materials:
        mesh.materials.append(m)
    if face_mats:
        for poly, mi in zip(mesh.polygons, face_mats):
            poly.material_index = mi
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def build_island(mat_grass, mat_dirt, mat_rock):
    """起伏顶面 + 内收的泥土/岩石裙边。"""
    cx, cy = CENTER_X, CENTER_Y
    verts, faces = top_grid_geometry()
    face_mats = [0] * len(faces)      # 0=grass

    # 裙边：顶缘（半径 25，顶面外环重合）→ 底部尖点
    rings = [
        (RADIUS,        TOP_Z,  0.00),   # 顶缘：严格半径 25（h 已压平到 0）
        (RADIUS * 0.92, -2.0,   0.05),
        (RADIUS * 0.62, -5.5,   0.09),
        (RADIUS * 0.30, -8.5,   0.12),
    ]
    ring_start = []
    for r, z, amp in rings:
        ring_start.append(len(verts))
        for i in range(SKIRT_SEGMENTS):
            a = 2 * math.pi * i / SKIRT_SEGMENTS
            rr = r * jitter(i, z, amp) if amp else r
            verts.append((cx + rr * math.cos(a), cy + rr * math.sin(a), z))
    bottom = len(verts)
    verts.append((cx, cy, -11.0))

    for band, (s0, s1) in enumerate(zip(ring_start, ring_start[1:])):
        for i in range(SKIRT_SEGMENTS):
            j = (i + 1) % SKIRT_SEGMENTS
            faces.append((s0 + i, s0 + j, s1 + j, s1 + i))  # 外侧
            face_mats.append(1 if band < 2 else 2)          # 1=dirt 2=rock
    sl = ring_start[-1]
    for i in range(SKIRT_SEGMENTS):
        j = (i + 1) % SKIRT_SEGMENTS
        faces.append((sl + i, sl + j, bottom))              # 底部扇形
        face_mats.append(2)

    return link_object('island_ground', verts, faces,
                       [mat_grass, mat_dirt, mat_rock], face_mats)


def build_walk_surface(mat_grass):
    """可行走顶面：与视觉顶面同一份起伏网格，抬高 0.01 避免 z-fighting。"""
    verts, faces = top_grid_geometry(z_offset=0.01)
    obj = link_object('WALK_island_top', verts, faces, [mat_grass])
    obj['surface_walkable'] = True
    obj['surface_placeable'] = True
    return obj


# ── 石板路 ──
def path_loop_points(step=0.9):
    """绕屋环路：圆角矩形 x±14.2, y∈[-6.2,+8.2]，角半径 2.0（离房墙 2.2m）。"""
    hx, y0, y1, cr = 14.2, -6.2, 8.2, 2.0
    pts = []

    def edge(p, q):
        n = max(1, round(math.dist(p, q) / step))
        for k in range(n):
            t = k / n
            pts.append((p[0] + (q[0] - p[0]) * t,
                        p[1] + (q[1] - p[1]) * t))

    def corner(c, a0, a1):
        n = max(2, round(abs(a1 - a0) * cr / step))
        for k in range(n):
            a = a0 + (a1 - a0) * k / n
            pts.append((c[0] + cr * math.cos(a), c[1] + cr * math.sin(a)))

    edge((-hx + cr, y0), (hx - cr, y0))                 # 南
    corner((hx - cr, y0 + cr), -math.pi / 2, 0)         # 东南角
    edge((hx, y0 + cr), (hx, y1 - cr))                  # 东
    corner((hx - cr, y1 - cr), 0, math.pi / 2)          # 东北角
    edge((hx - cr, y1), (-hx + cr, y1))                 # 北
    corner((-hx + cr, y1 - cr), math.pi / 2, math.pi)   # 西北角
    edge((-hx, y1 - cr), (-hx, y0 + cr))                # 西
    corner((-hx + cr, y0 + cr), math.pi, math.pi * 1.5)  # 西南角
    return pts


def path_branch_points(step=0.9):
    """南向支路：环路南边中点(0, -6.2) → 岛南缘，正弦蜿蜒。"""
    length = 20.3   # → y ≈ -26.5（离岛心 21.5，仍在岛内）
    n = round(length / step)
    pts = []
    for k in range(1, n + 1):
        t = k / n
        pts.append((1.6 * math.sin(t * 2.4), -6.2 - length * t))
    return pts


def build_stone_path(mat_stone, loop_pts, branch_pts):
    """沿路径每 ~0.9m 一块不规则石板，顶面高出地面 0.03（不挡导航）。"""
    rng = random.Random(20260730)
    verts, faces = [], []
    for px, py in loop_pts + branch_pts:
        x = px + rng.uniform(-0.15, 0.15)
        y = py + rng.uniform(-0.15, 0.15)
        if math.hypot(x - CENTER_X, y - CENTER_Y) > RADIUS - 1.0:
            continue
        r = rng.uniform(0.35, 0.55)
        nseg = rng.randint(6, 8)
        rot = rng.uniform(0, math.pi)
        tilt = rng.uniform(-0.035, 0.035)
        z = TOP_Z + terrain_h(x, y) + 0.03
        cos_t, sin_t = math.cos(tilt), math.sin(tilt)
        base = len(verts)
        for rr, zz in ((r, -0.045), (r * 0.92, 0.045)):
            for i in range(nseg):
                a = rot + 2 * math.pi * i / nseg
                lx, ly = rr * math.cos(a), rr * math.sin(a)
                wy = ly * cos_t - zz * sin_t   # 绕 X 轴微倾斜
                wz = ly * sin_t + zz * cos_t
                verts.append((x + lx, y + wy, z + wz))
        for i in range(nseg):                   # 侧面（法线朝外）
            j = (i + 1) % nseg
            faces.append((base + i, base + j,
                          base + nseg + j, base + nseg + i))
        faces.append(tuple(base + nseg + i for i in range(nseg)))            # 顶
        faces.append(tuple(base + i for i in reversed(range(nseg))))         # 底

    obj = link_object('PATH_stones', verts, faces, [mat_stone])
    # 不标任何 surface 属性：高出地面 <0.15m，导航净空规则天然忽略
    return obj


# ── 植被散布 ──
def scatter_points(rng, count, r_max, avoid, clearance):
    """岛内均匀随机散布，避开房子与 avoid 列表里的点。"""
    pts = []
    tries = 0
    while len(pts) < count and tries < count * 40:
        tries += 1
        a = rng.uniform(0, 2 * math.pi)
        r = r_max * math.sqrt(rng.uniform(0, 1))
        x = CENTER_X + r * math.cos(a)
        y = CENTER_Y + r * math.sin(a)
        if dist_house(x, y) < 1.0:
            continue
        c2 = clearance * clearance
        if any((x - px) ** 2 + (y - py) ** 2 < c2 for px, py in avoid):
            continue
        pts.append((x, y))
    return pts


def build_grass_tufts(mat_grass, rng, spots):
    """每簇 3~5 片三角草叶，共享 MAT_grass（随季节变色）。纯视觉：nav_ignore。"""
    verts, faces = [], []
    for x, y in spots:
        z = TOP_Z + terrain_h(x, y) - 0.01
        for _ in range(rng.randint(3, 5)):
            a = rng.uniform(0, 2 * math.pi)
            dx, dy = math.cos(a), math.sin(a)
            h = rng.uniform(0.15, 0.30)
            w = rng.uniform(0.04, 0.07)      # 叶片半宽
            lean = rng.uniform(0.04, 0.10)   # 叶尖外倾
            bx, by = x + rng.uniform(-0.05, 0.05), y + rng.uniform(-0.05, 0.05)
            base = len(verts)
            verts.append((bx - dy * w, by + dx * w, z))
            verts.append((bx + dy * w, by - dx * w, z))
            verts.append((bx + dx * lean, by + dy * lean, z + h))
            faces.append((base, base + 1, base + 2))
    obj = link_object('GRASS_tufts', verts, faces, [mat_grass])
    obj['nav_ignore'] = True   # 纯视觉，不进导航（否则高于 0.15m 会挡路）
    return obj


def build_flower_species(name, colors, bloom_in, bloom_out, rng, spots,
                         stem_range, head_range):
    """一种花：细茎 + 八面体花头；花期窗口写入 extras（JS 透明度淡入淡出）。"""
    mats = [make_flat_material(f'MAT_{name}_{i}', c)
            for i, c in enumerate(colors)]
    verts, faces, face_mats = [], [], []
    for x, y in spots:
        z = TOP_Z + terrain_h(x, y)
        h = rng.uniform(*stem_range)
        r = rng.uniform(*head_range)
        mi = rng.randrange(len(mats))
        # 茎：细三角
        a = rng.uniform(0, 2 * math.pi)
        dx, dy = math.cos(a) * 0.015, math.sin(a) * 0.015
        base = len(verts)
        verts.append((x - dx, y - dy, z))
        verts.append((x + dx, y + dy, z))
        verts.append((x, y, z + h))
        faces.append((base, base + 1, base + 2))
        face_mats.append(mi)
        # 花头：八面体（上/下尖 + 4 赤道点）
        base = len(verts)
        cz = z + h + r * 0.4
        verts.append((x, y, cz + r))                       # 顶 0
        verts.append((x, y, cz - r * 0.6))                 # 底 1
        for i in range(4):
            aa = a + math.pi / 2 * i
            verts.append((x + r * math.cos(aa), y + r * math.sin(aa), cz))
        for i in range(4):
            j = (i + 1) % 4
            faces.append((base, base + 2 + i, base + 2 + j))       # 上半
            faces.append((base + 1, base + 2 + j, base + 2 + i))   # 下半
            face_mats.extend((mi, mi))
    obj = link_object(name, verts, faces, mats, face_mats)
    obj['nav_ignore'] = True
    obj['flower_bloom_in'] = bloom_in
    obj['flower_bloom_out'] = bloom_out
    return obj


# ── 树 ──
def add_prism(verts, faces, cx, cy, z0, z1, r0, r1, off_x, off_y, nseg=6):
    """一段锥柱：底心(cx,cy,z0) 半径 r0 → 顶心(+off) z1 半径 r1。"""
    base = len(verts)
    for rr, zz, ox, oy in ((r0, z0, 0.0, 0.0), (r1, z1, off_x, off_y)):
        for i in range(nseg):
            a = 2 * math.pi * i / nseg
            verts.append((cx + ox + rr * math.cos(a),
                          cy + oy + rr * math.sin(a), zz))
    for i in range(nseg):
        j = (i + 1) % nseg
        faces.append((base + i, base + j, base + nseg + j, base + nseg + i))
    faces.append(tuple(base + nseg + i for i in range(nseg)))            # 顶
    faces.append(tuple(base + i for i in reversed(range(nseg))))         # 底


def add_branch(verts, faces, start, direction, length, r0, r1, nseg=5):
    """任意方向的锥柱枝条，返回枝尖坐标（Vector）。"""
    d = Vector(direction).normalized()
    ref = Vector((0, 0, 1)) if abs(d.z) < 0.9 else Vector((1, 0, 0))
    u = d.cross(ref).normalized()
    v = d.cross(u).normalized()
    base = len(verts)
    for t, r in ((0.0, r0), (1.0, r1)):
        c = Vector(start) + d * (length * t)
        for i in range(nseg):
            a = 2 * math.pi * i / nseg
            p = c + r * (math.cos(a) * u + math.sin(a) * v)
            verts.append(tuple(p))
    for i in range(nseg):
        j = (i + 1) % nseg
        faces.append((base + i, base + j, base + nseg + j, base + nseg + i))
    faces.append(tuple(base + nseg + i for i in range(nseg)))
    return Vector(start) + d * length


def add_icosphere(verts, faces, center, radius, squash_z=1.0):
    """20 面球（subdivisions=1 icosphere），可沿 z 压扁（雪盖用）。"""
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=1, radius=radius)
    base = len(verts)
    cx, cy, cz = center
    for v in bm.verts:
        verts.append((cx + v.co.x, cy + v.co.y, cz + v.co.z * squash_z))
    for f in bm.faces:
        faces.append(tuple(base + v.index for v in f.verts))
    bm.free()


def build_deciduous(key, x, y, seed, mat_trunk, mat_leaves, mat_fruit,
                    mat_snow, spring, autumn):
    """落叶树：微弯主干 + 3~4 根分枝（冬季落叶后枝干依然自然）+ 错位叶球。

    额外产出：秋果（leaf 球下缘挂果）+ 雪盖（叶球顶部压扁白球）。
    """
    rng = random.Random(seed)
    base_z = TOP_Z + terrain_h(x, y)

    # ── 枝干（顶点相对树根原点）──
    verts, faces = [], []
    h1 = rng.uniform(1.0, 1.4)
    r1 = rng.uniform(0.28, 0.38)
    lean_a = rng.uniform(0, 2 * math.pi)
    lean = rng.uniform(0.08, 0.2)
    lx, ly = math.cos(lean_a) * lean, math.sin(lean_a) * lean
    add_prism(verts, faces, 0, 0, 0, h1, r1, r1 * 0.75, lx * 0.5, ly * 0.5)

    tips = []   # 枝尖（相对坐标）
    n_branch = rng.randint(3, 4)
    az0 = rng.uniform(0, 2 * math.pi)
    for k in range(n_branch):
        az = az0 + 2 * math.pi * k / n_branch + rng.uniform(-0.4, 0.4)
        tilt = rng.uniform(0.5, 0.95)      # 与竖直方向夹角
        direction = (math.sin(tilt) * math.cos(az),
                     math.sin(tilt) * math.sin(az), math.cos(tilt))
        start = (lx * 0.5, ly * 0.5, h1 * rng.uniform(0.8, 0.98))
        tip = add_branch(verts, faces, start, direction,
                         rng.uniform(0.9, 1.5),
                         rng.uniform(0.10, 0.16), 0.03)
        tips.append(tip)
    # 顶端续枝
    tips.append(add_branch(verts, faces,
                           (lx * 0.5, ly * 0.5, h1),
                           (lx * 2, ly * 2, 1.0),
                           rng.uniform(0.5, 0.9), r1 * 0.6, 0.04))

    trunk = link_object(f'{key}_trunk', verts, faces, [mat_trunk])
    trunk.location = (x, y, base_z - 0.05)   # 底部嵌入地面 5cm
    # 不标任何属性 → 导航网格自动视为障碍

    # ── 叶球（世界坐标；枝尖小球 + 主冠大球）──
    lobes = []   # (中心 Vector 世界坐标, 半径)
    for tip in tips:
        c = Vector((x + tip.x, y + tip.y, base_z + tip.z))
        lobes.append((c, rng.uniform(0.7, 1.1)))
    crown = Vector((x + lx, y + ly, base_z + h1 + rng.uniform(0.5, 0.8)))
    lobes.append((crown, rng.uniform(1.2, 1.6)))

    verts, faces = [], []
    for c, r in lobes:
        add_icosphere(verts, faces, c, r)
    leaves = link_object(f'{key}_leaves', verts, faces, [mat_leaves])
    leaves['season_leaves'] = True
    leaves['tree_type'] = 'deciduous'
    leaves['leaf_spring'] = spring
    leaves['leaf_autumn'] = autumn

    # ── 秋果（世界坐标，叶球下缘挂 6~10 颗，材质即果子颜色）──
    verts, faces = [], []
    for _ in range(rng.randint(6, 10)):
        c, r = rng.choice(lobes)
        aa = rng.uniform(0, 2 * math.pi)
        rr = rng.uniform(0.2, 0.7) * r
        fc = (c.x + rr * math.cos(aa), c.y + rr * math.sin(aa),
              c.z - r * rng.uniform(0.4, 0.7))
        add_icosphere(verts, faces, fc, rng.uniform(0.09, 0.13))
    fruits = link_object(f'{key}_fruits', verts, faces, [mat_fruit])
    fruits['season_fruits'] = True

    # ── 雪盖（世界坐标，叶球顶部压扁白球，冬季显现）──
    verts, faces = [], []
    for c, r in lobes:
        add_icosphere(verts, faces,
                      (c.x, c.y, c.z + r * 0.55), r * 0.85, squash_z=0.42)
    snow = link_object(f'{key}_snow', verts, faces, [mat_snow])
    snow['season_snow'] = True
    return trunk


def build_pine(key, x, y, seed, mat_trunk, mat_leaves, mat_snow):
    """松树：短树干 + 3~4 层叠锥形树冠（常青，冬季不落叶）+ 每层雪盖。"""
    rng = random.Random(seed)
    base_z = TOP_Z + terrain_h(x, y)

    # ── 树干（顶点相对树根原点）──
    verts, faces = [], []
    th = rng.uniform(0.7, 1.0)
    add_prism(verts, faces, 0, 0, 0, th, rng.uniform(0.24, 0.32), 0.18, 0, 0)
    trunk = link_object(f'{key}_trunk', verts, faces, [mat_trunk])
    trunk.location = (x, y, base_z - 0.05)

    # ── 树冠层（世界坐标）+ 每层雪盖 ──
    verts, faces = [], []
    snow_verts, snow_faces = [], []
    z = th * 0.7
    r = rng.uniform(1.5, 1.9)
    n_layers = rng.randint(3, 4)
    for i in range(n_layers):
        depth = rng.uniform(0.9, 1.2)
        r2 = r * 0.5 if i < n_layers - 1 else 0.08
        add_prism(verts, faces, x, y, base_z + z, base_z + z + depth,
                  r, r2, 0, 0, nseg=8)
        # 雪盖：盖住该层上半部分（半径略大，罩在绿层外）
        z1, z2 = z + depth * 0.55, z + depth
        rad1 = r + (r2 - r) * 0.55
        add_prism(snow_verts, snow_faces, x, y, base_z + z1, base_z + z2,
                  rad1 * 1.04, r2 * 1.04 + 0.02, 0, 0, nseg=8)
        z += depth * 0.55   # 层间重叠
        r *= 0.72

    leaves = link_object(f'{key}_leaves', verts, faces, [mat_leaves])
    leaves['season_leaves'] = True
    leaves['tree_type'] = 'pine'

    snow = link_object(f'{key}_snow', snow_verts, snow_faces, [mat_snow])
    snow['season_snow'] = True
    return trunk


# ── 雪人（冬季限定）──
def build_snowman(mat_snow, mat_carrot, mat_coal, mat_trunk):
    """三球雪人 + 胡萝卜鼻子 + 树枝手臂。原点在底座中心（JS 整体缩放）。"""
    sx, sy = SNOWMAN_POS
    verts, faces, face_mats = [], [], []

    def sphere(c, r, mi):
        base = len(faces)
        add_icosphere(verts, faces, c, r)
        face_mats.extend([mi] * (len(faces) - base))

    # 0=雪 1=胡萝卜 2=煤球 3=树枝
    sphere((0, 0, 0.5), 0.55, 0)            # 底座
    sphere((0, 0, 1.25), 0.40, 0)           # 身
    sphere((0, 0, 1.85), 0.28, 0)           # 头
    sphere((-0.09, -0.24, 1.93), 0.035, 2)  # 左眼（朝 -y = three +z 南）
    sphere((0.09, -0.24, 1.93), 0.035, 2)   # 右眼
    sphere((0, -0.30, 1.55), 0.04, 2)       # 扣子
    sphere((0, -0.28, 1.35), 0.04, 2)
    # 胡萝卜鼻子（朝南 -y 的锥）
    base = len(verts)
    nose = [(0, -0.26, 1.85), (-0.05, -0.26, 1.80), (0.05, -0.26, 1.80),
            (0, -0.26, 1.90), (0, -0.55, 1.83)]
    verts.extend(nose)
    faces.extend([(base, base + 1, base + 4), (base + 1, base + 2, base + 4),
                  (base + 2, base + 3, base + 4), (base + 3, base, base + 4),
                  (base, base + 3, base + 2), (base, base + 2, base + 1)])
    face_mats.extend([1] * 6)
    # 树枝手臂
    base = len(faces)
    add_branch(verts, faces, (-0.35, 0, 1.3), (-1, 0.1, 0.5), 0.55, 0.03, 0.015)
    add_branch(verts, faces, (0.35, 0, 1.3), (1, -0.1, 0.55), 0.55, 0.03, 0.015)
    face_mats.extend([3] * (len(faces) - base))

    obj = link_object('SNOWMAN', verts, faces,
                      [mat_snow, mat_carrot, mat_coal, mat_trunk], face_mats)
    obj.location = (sx, sy, TOP_Z + terrain_h(sx, sy) - 0.03)
    obj['season_snowman'] = True
    obj['nav_ignore'] = True   # 四季导航保持一致（雪人冬显冬隐）
    return obj


def main():
    clear_scene()

    mat_grass = make_flat_material('MAT_grass', '#7a9e6d')   # 与旧草地一致
    mat_dirt = make_flat_material('MAT_dirt', '#8a6a4e')
    mat_rock = make_flat_material('MAT_rock', '#7a7268')
    mat_trunk = make_flat_material('MAT_trunk', '#6e4b30')
    mat_leaves = make_flat_material('MAT_leaves', '#4f7f3f')
    mat_stone = make_flat_material('MAT_stone', '#8d8d94')
    mat_snow = make_flat_material('MAT_snow', '#f4f6f8')
    mat_carrot = make_flat_material('MAT_carrot', '#e07830')
    mat_coal = make_flat_material('MAT_coal', '#2a2a2a')
    mats_fruit = {
        PURPLE: make_flat_material('MAT_fruit_purple', PURPLE),
        RED: make_flat_material('MAT_fruit_red', RED),
        ORANGE: make_flat_material('MAT_fruit_orange', ORANGE),
    }

    build_island(mat_grass, mat_dirt, mat_rock)
    build_walk_surface(mat_grass)

    loop_pts = path_loop_points()
    branch_pts = path_branch_points()
    build_stone_path(mat_stone, loop_pts, branch_pts)
    print(f'石板路: 环路 {len(loop_pts)} 块 + 支路 {len(branch_pts)} 块')

    # 植被避让点：石板路 + 树干 + 雪人
    tree_xy = [(x, y) for _, x, y, *_ in TREES]
    avoid = loop_pts + branch_pts + tree_xy + [SNOWMAN_POS]

    rng = random.Random(114514)
    grass_spots = scatter_points(rng, 220, 23.5, avoid, clearance=0.8)
    build_grass_tufts(mat_grass, rng, grass_spots)
    print(f'草丛 {len(grass_spots)} 簇')

    occupied = list(avoid)
    for name, colors, b_in, b_out, count, stem_r, head_r in FLOWER_SPECIES:
        spots = scatter_points(rng, count, 22.5, occupied, clearance=0.9)
        build_flower_species(name, colors, b_in, b_out, rng, spots,
                             stem_r, head_r)
        occupied.extend(spots)
        print(f'{name}: {len(spots)} 朵, 花期 {b_in}~{b_out}')

    for key, x, y, seed, ttype, spring, autumn, fruit in TREES:
        # 校验：在岛屿半径内、离房墙 ≥3m
        dist_c = math.hypot(x - CENTER_X, y - CENTER_Y)
        dist_h = dist_house(x, y)
        assert dist_c <= RADIUS - 2.5, f'{key} 超出岛屿: {dist_c:.1f}'
        assert dist_h >= 3.0, f'{key} 离房子太近: {dist_h:.1f}'
        if ttype == 'deciduous':
            build_deciduous(key, x, y, seed, mat_trunk, mat_leaves,
                            mats_fruit[fruit], mat_snow, spring, autumn)
        else:
            build_pine(key, x, y, seed, mat_trunk, mat_leaves, mat_snow)
        print(f'{key} ({ttype}): three({x}, {-y}) '
              f'地面 h={terrain_h(x, y):+.2f} 离房 {dist_h:.1f}m')

    build_snowman(mat_snow, mat_carrot, mat_coal, mat_trunk)
    print(f'雪人: three({SNOWMAN_POS[0]}, {-SNOWMAN_POS[1]})')

    # 起伏幅度自查：相邻格(0.1m)高差必须 ≪0.35（导航 MAX_STEP）
    max_grad = 0.0
    for i in range(-240, 241):
        x = i * 0.1
        g = abs(terrain_h(x + 0.1, CENTER_Y) - terrain_h(x, CENTER_Y))
        max_grad = max(max_grad, g)
    print(f'地形 0.1m 最大高差: {max_grad:.4f}m（需 ≪ 0.35）')
    assert max_grad < 0.08

    bpy.ops.wm.save_as_mainfile(filepath=BLEND_OUT)
    print(f'已保存 {BLEND_OUT}')

    bpy.ops.export_scene.gltf(
        filepath=GLB_OUT,
        export_format='GLB',
        export_extras=True,      # Custom Properties 必须
        export_apply=True,       # apply modifiers
        export_animations=False,
    )
    print(f'已导出 {GLB_OUT}')


main()
