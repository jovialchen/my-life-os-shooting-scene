"""从零建模"悬浮岛屿"地面，替代原平面草地圆盘。

坐标约定：Blender(x, y, z) → three.js(x, z, -y)，three.js Y 轴朝上。
旧草地（js/elements/houseShell.js）：CircleGeometry 半径 25，
three 中心 (x=0, z=5)，顶面 y=-0.02。
→ 对应 Blender 中心 (0, -5)，顶面 z=-0.02。本脚本严格对齐此参数。

产物：
  models_src/island.blend
  models/island.glb（glTF Binary，apply modifiers，export_extras=True）

用法:
  "/c/Program Files/Blender Foundation/Blender 5.1/blender.exe" -b --python tools/make_island.py
"""
import math
import os

import bmesh
import bpy
from mathutils import Matrix

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BLEND_OUT = os.path.join(ROOT, 'models_src', 'island.blend')
GLB_OUT = os.path.join(ROOT, 'models', 'island.glb')

# ── 岛屿参数（与旧草地圆盘一致）──
CENTER_X = 0.0
CENTER_Y = -5.0   # Blender y = -three.z（three 中心 z=5）
TOP_Z = -0.02     # 旧草地 position.y = -0.02
RADIUS = 25.0
SEGMENTS = 18     # 低多边形

# 树木位置（Blender 坐标）。房子 footprint: three x±12, z-6…+4
# → Blender x±12, y-4…+6。所有树离房墙 ≥3m 且在半径 25 内。
TREES = [
    ('TREE_01', -18.0, -6.0),   # three(-18,  6)  西侧
    ('TREE_02',  17.0, -8.0),   # three( 17,  8)  东侧
    ('TREE_03',   2.0, -21.0),  # three(  2, 21)  南侧
    ('TREE_04', -16.0,  9.0),   # three(-16, -9)  西北侧（离房角 5m）
    ('TREE_05',  16.0,  8.0),   # three( 16, -8)  东北侧（离房角约 4.5m）
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


def jitter(i, seed, amp):
    """确定性的径向抖动，让裙边有岩石感。"""
    return 1.0 + amp * math.sin(i * 2.3 + seed) * math.cos(i * 0.7 + seed * 2)


def build_island(mat_grass, mat_dirt, mat_rock):
    """裙边式浮岛：平顶 + 内收的泥土/岩石侧面。"""
    cx, cy = CENTER_X, CENTER_Y
    # (半径, z, 抖动幅度)
    rings = [
        (RADIUS,        TOP_Z,  0.00),   # 顶缘：严格半径 25
        (RADIUS * 0.92, -2.0,   0.05),
        (RADIUS * 0.62, -5.5,   0.09),
        (RADIUS * 0.30, -8.5,   0.12),
    ]
    verts = []
    # 顶面中心点
    top_center = len(verts)
    verts.append((cx, cy, TOP_Z))
    ring_start = []
    for r, z, amp in rings:
        ring_start.append(len(verts))
        for i in range(SEGMENTS):
            a = 2 * math.pi * i / SEGMENTS
            rr = r * jitter(i, z, amp) if amp else r
            verts.append((cx + rr * math.cos(a), cy + rr * math.sin(a), z))
    bottom = len(verts)
    verts.append((cx, cy, -11.0))

    faces = []
    face_mats = []  # 0=grass 1=dirt 2=rock
    r0 = ring_start[0]
    for i in range(SEGMENTS):
        j = (i + 1) % SEGMENTS
        faces.append((top_center, r0 + j, r0 + i))  # 顶面（朝上）
        face_mats.append(0)
    for band, (s0, s1) in enumerate(zip(ring_start, ring_start[1:])):
        for i in range(SEGMENTS):
            j = (i + 1) % SEGMENTS
            faces.append((s0 + i, s0 + j, s1 + j, s1 + i))  # 外侧
            face_mats.append(1 if band < 2 else 2)
    sl = ring_start[-1]
    for i in range(SEGMENTS):
        j = (i + 1) % SEGMENTS
        faces.append((sl + i, sl + j, bottom))  # 底部扇形
        face_mats.append(2)

    mesh = bpy.data.meshes.new('island_ground')
    mesh.from_pydata(verts, [], faces)
    mesh.materials.append(mat_grass)
    mesh.materials.append(mat_dirt)
    mesh.materials.append(mat_rock)
    for poly, mi in zip(mesh.polygons, face_mats):
        poly.material_index = mi
    obj = bpy.data.objects.new('island_ground', mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def build_walk_surface(mat_grass):
    """可行走顶面：半径 25 的圆片，略高于视觉顶面避免 z-fighting。"""
    z = TOP_Z + 0.01
    verts = [(CENTER_X, CENTER_Y, z)]
    for i in range(64):
        a = 2 * math.pi * i / 64
        verts.append((CENTER_X + RADIUS * math.cos(a),
                      CENTER_Y + RADIUS * math.sin(a), z))
    faces = [(0, (i + 1) % 64 + 1, i + 1) for i in range(64)]
    mesh = bpy.data.meshes.new('WALK_island_top')
    mesh.from_pydata(verts, [], faces)
    mesh.materials.append(mat_grass)
    obj = bpy.data.objects.new('WALK_island_top', mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj['surface_walkable'] = True
    obj['surface_placeable'] = True
    return obj


def build_tree(name, x, y, mat_trunk, mat_leaves):
    """低多边形树：圆柱树干 + 双球块状树叶（树叶独立 mesh，支持四季）。"""
    # 树干：6 边圆柱，不标任何属性 → 导航网格自动视为障碍
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=6, radius=0.35, depth=2.4,
        location=(x, y, TOP_Z + 1.2))
    trunk = bpy.context.active_object
    trunk.name = f'{name}_trunk'
    trunk.data.name = trunk.name
    trunk.data.materials.append(mat_trunk)

    # 树叶：两个 icosphere 合并成一个 mesh（bmesh，无需 ops）
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1.9,
                               matrix=Matrix.Translation((x, y, TOP_Z + 3.4)))
    bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1.3,
                               matrix=Matrix.Translation((x, y, TOP_Z + 5.0)))
    mesh = bpy.data.meshes.new(f'{name}_leaves')
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(mat_leaves)
    leaves = bpy.data.objects.new(f'{name}_leaves', mesh)
    bpy.context.scene.collection.objects.link(leaves)
    leaves['season_leaves'] = True
    return trunk, leaves


def main():
    clear_scene()

    mat_grass = make_flat_material('MAT_grass', '#7a9e6d')   # 与旧草地一致
    mat_dirt = make_flat_material('MAT_dirt', '#8a6a4e')
    mat_rock = make_flat_material('MAT_rock', '#7a7268')
    mat_trunk = make_flat_material('MAT_trunk', '#6e4b30')
    mat_leaves = make_flat_material('MAT_leaves', '#4f7f3f')

    build_island(mat_grass, mat_dirt, mat_rock)
    build_walk_surface(mat_grass)

    for name, x, y in TREES:
        # 校验：在岛屿半径内、离房墙 ≥3m（房子 Blender x±12, y-4…+6）
        dist_c = math.hypot(x - CENTER_X, y - CENTER_Y)
        dx = max(0.0, abs(x) - 12.0)
        dy = max(0.0, max(y - 6.0, -4.0 - y))
        dist_house = math.hypot(dx, dy)
        assert dist_c <= RADIUS - 2.5, f'{name} 超出岛屿: {dist_c:.1f}'
        assert dist_house >= 3.0, f'{name} 离房子太近: {dist_house:.1f}'
        build_tree(name, x, y, mat_trunk, mat_leaves)
        print(f'{name}: blender({x}, {y}) three({x}, {-y}) '
              f'离中心 {dist_c:.1f}m 离房 {dist_house:.1f}m')

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
