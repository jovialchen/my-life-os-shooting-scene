"""从 changjing.blend 提取厨房/卫浴家具 → 3 个家具 GLB：

  models/furniture_kitchen.glb   → f1_kitchen（10×12，北墙 L 橱柜 + 东墙冰箱 + 中岛）
  models/furniture_bath_f1.glb   → f1_bath（8×10，浴缸东墙 + 马桶东北 + 洗手盆/镜子北墙西）
  models/furniture_bath_f2.glb   → f2_bath1/2/3 共用（7×7，浴缸西墙 + 马桶/洗手盆北墙）

提取对象（changjing.blend 原命名，见 temp/changjing_objects.txt）：
  厨房：Cube.002 L 下柜 / Cube L 吊柜 / Cube.003 水槽灶台 / Cube.001 冰箱
        / Cube.004+005 中岛吧台 / Plane.003-005 吧凳 / 把手龙头小件
  卫浴：Cube.009 浴缸(+Cylinder/.006/.007/.008 龙头花洒) / Plane.001 马桶
        / Cube.010 洗手盆(+Cylinder.001/.005/.009/.010 龙头, Cylinder.014 下水管)
        / Cube.011 镜子(nav_ignore)

摆位坐标用 three.js 房间坐标（原点=南门地板中心，y 上，z 进房），脚本内部转
Blender z-up：blender=(x, -z, y)，rotY → rotation.z（同 make_living_furniture.py）。
材质全局替换为 NPR 平涂（flat_materials.make_flat_material），按原名映射 +
逐对象覆盖。家具不设 extras = 自动导航障碍；镜子设 nav_ignore。

用法: tools/blender.sh -b changjing.blend -P tools/make_changjing_furniture.py
同时输出摆位校验图 temp/cgf_{kitchen,bath_f1,bath_f2}_{top,iso}.png
（灰地板=房间范围，红块=spawn 落点）。
"""
import math
import os
import sys

import bpy
from mathutils import Matrix, Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
from flat_materials import make_flat_material  # noqa: E402

OUT_DIR = os.path.join(ROOT, 'models')

# ── 材质映射：原名 → (新材质名, 颜色, 自发光) ──
MAT_MAP = {
    'bak':       ('MAT_ceramic', '#F4F4F0', 0.0),   # 浴缸/马桶/洗手盆/镜框陶瓷
    'metal':     ('MAT_metal',   '#B9BEC5', 0.0),   # 龙头/把手/金属件
    'kaca':      ('MAT_glass',   '#A9D3DE', 0.0),   # 玻璃/镜面
    'reflect':   ('MAT_counter', '#EFEFEA', 0.0),   # 台面
    'sofa':      ('MAT_cabinet', '#D9BC8C', 0.0),   # 橱柜柜体（浅橡木）
    'hitam':     ('MAT_dark',    '#3A3632', 0.0),   # 吊柜深色点缀
    'Material':  ('MAT_trim',    '#8A8580', 0.0),   # 吊柜把手等
    'bluemetal': ('MAT_bluegray', '#93A8B8', 0.0),  # 家电/中岛默认蓝灰
    'lamp':      ('MAT_lamp',    '#FFF3C4', 1.0),   # 灯（冰箱灯条等）
}
# 逐对象材质覆盖：对象名 → {原材质名: (新材质名, 颜色, 自发光)}
MAT_OVERRIDE = {
    'Cube.001':  {'kaca': ('MAT_enamel', '#C6D9E2', 0.0)},       # 冰箱珐琅蓝（不用玻璃材质）
    'Cube.004':  {'bluemetal': ('MAT_wood_walnut', '#8A5A3B', 0.0)},   # 中岛底座胡桃木
    'Cube.005':  {'bluemetal': ('MAT_counter', '#EFEFEA', 0.0)},       # 中岛台面白
    'Plane.003': {'metal': ('MAT_stool_coral', '#C47F62', 0.0)},       # 吧凳三色（呼应客厅）
    'Plane.004': {'metal': ('MAT_stool_sage', '#A9BC90', 0.0)},
    'Plane.005': {'metal': ('MAT_stool_oak', '#D9BC8C', 0.0)},
}

# ── 家具组：src=changjing 对象名 → 导出名；rotY/target 见各房间表 ──
G_CABINETS = {   # L 下柜 + L 吊柜 + 水槽灶台 + 把手/龙头/托盘小件
    'Cube.002': 'FURN_cabinet_low', 'Cube': 'FURN_cabinet_up',
    'Cube.003': 'FURN_sink_stove',
    'Cube.014': 'FURN_h_up1', 'Cube.028': 'FURN_h_up2', 'Cube.029': 'FURN_h_up3',
    'Cube.030': 'FURN_h_low1', 'Cube.031': 'FURN_h_low2',
    'Cylinder.017': 'FURN_faucet_k', 'Cylinder.018': 'FURN_faucet_k2',
    'Cylinder.021': 'FURN_knob1', 'Cylinder.022': 'FURN_knob2',
    'Torus': 'FURN_tray',
}
G_FRIDGE = {'Cube.001': 'FURN_fridge',
            'Cylinder.025': 'FURN_fridge_h1', 'Cylinder.026': 'FURN_fridge_h2'}
G_ISLAND = {'Cube.004': 'FURN_island', 'Cube.005': 'FURN_island_top',
            'Plane.003': 'FURN_stool1', 'Plane.004': 'FURN_stool2',
            'Plane.005': 'FURN_stool3'}
G_TUB = {'Cube.009': 'FURN_tub', 'Cylinder': 'FURN_tub_tap',
         'Cylinder.006': 'FURN_tub_knob', 'Cylinder.007': 'FURN_tub_shower',
         'Cylinder.008': 'FURN_tub_faucet'}
G_TOILET = {'Plane.001': 'FURN_toilet'}
G_SINK = {'Cube.010': 'FURN_sink', 'Cube.011': 'FURN_mirror',
          'Cylinder.001': 'FURN_tap1', 'Cylinder.005': 'FURN_tap_knob',
          'Cylinder.009': 'FURN_tap_l', 'Cylinder.010': 'FURN_tap_r',
          'Cylinder.014': 'FURN_pipe'}
NAV_IGNORE = {'FURN_mirror'}   # 贴墙悬空，不挡导航

# ── 房间摆位表 ──
# rotY: three.js 角度；ref 取组 bbox 的 ('min'/'max'/'center', 同左)（changjing x/y）；
# target=(房间 x, 房间 z)：ref 经 rotY 旋转后落到的房间点；snap_floor: 组最低点贴 y=0
ROOMS = [
    {
        'id': 'kitchen', 'file': 'furniture_kitchen.glb', 'w': 10, 'd': 12,
        'spawns': [(0, 0.9), (4, 2.2), (-4.5, 11.3)],
        'groups': [
            # 东北角 L：长下柜跑北墙 x1.37..4.95（让开北窗组 x≤0.94 + 间隙），
            # 短跑东墙贴内墙面 x≤4.95（z9.8..12）；灶台/把手全部退出窗洞带
            {'objs': G_CABINETS, 'rotY': 90, 'ref': ('min', 'min'),
             'target': (4.95, 11.98), 'snap_floor': True},
            # 冰箱立东墙（L 短跑以南），面朝 -x
            {'objs': G_FRIDGE, 'rotY': 180, 'ref': ('min', 'min'),
             'target': (4.95, 8.4), 'snap_floor': True},
            # 中岛贴着橱柜 L 摆（操作区）：岛体 x0.9..2.9 / z9.75..10.48，
            # 与北墙柜台面留 0.85m 走道；吧凳在南侧/东端。南半房留给餐桌区
            {'objs': G_ISLAND, 'rotY': 90, 'ref': ('min', 'min'),
             'target': (3.69, 10.63), 'snap_floor': True},
        ],
    },
    {
        'id': 'bath_f1', 'file': 'furniture_bath_f1.glb', 'w': 8, 'd': 10,
        'spawns': [(0, 0.9)],
        'groups': [
            # 浴缸东墙，龙头朝北
            {'objs': G_TUB, 'rotY': 180, 'ref': ('min', 'min'),
             'target': (3.81, 3.5), 'snap_floor': True},
            # 马桶东北角，水箱贴北墙、面朝南
            {'objs': G_TOILET, 'rotY': 180, 'ref': ('min', 'min'),
             'target': (2.68, 8.72), 'snap_floor': True},
            # 洗手盆+镜子：北墙西段（让开窗洞 x≥-1.39）
            {'objs': G_SINK, 'rotY': 180, 'ref': ('min', 'min'),
             'target': (-2.04, 9.07), 'snap_floor': True},
        ],
    },
    {
        'id': 'bath_f2', 'file': 'furniture_bath_f2.glb', 'w': 7, 'd': 7,
        'spawns': [(0, 0.9)],
        'groups': [
            # 浴缸西墙，龙头朝北
            {'objs': G_TUB, 'rotY': 180, 'ref': ('min', 'min'),
             'target': (-2.21, 3.4), 'snap_floor': True},
            # 马桶北墙东，水箱贴墙
            {'objs': G_TOILET, 'rotY': 180, 'ref': ('min', 'min'),
             'target': (2.78, 5.62), 'snap_floor': True},
            # 洗手盆+镜子：北墙中段
            {'objs': G_SINK, 'rotY': 180, 'ref': ('min', 'min'),
             'target': (1.51, 6.07), 'snap_floor': True},
        ],
    },
]


def remap_materials():
    """全局把 changjing 材质换成 NPR 平涂（不保存 .blend，改原件无副作用）。"""
    cache = {}

    def flat(entry):
        name, hex_color, emission = entry
        key = name
        if key not in cache:
            cache[key] = make_flat_material(name, hex_color, emission=emission)
        return cache[key]

    used = set()
    for spec in ROOMS:
        for g in spec['groups']:
            used.update(g['objs'])
    for name in used:
        ob = bpy.data.objects.get(name)
        assert ob, f'源对象 {name} 不存在'
        override = MAT_OVERRIDE.get(name, {})
        for slot in ob.material_slots:
            orig = slot.material.name if slot.material else None
            assert orig, f'{name} 有空材质槽'
            base = orig.split('.')[0] if orig.startswith('Material.') else orig
            key = orig if orig in MAT_MAP else base
            if orig in override:
                slot.material = flat(override[orig])
            else:
                assert key in MAT_MAP, f'{name} 的材质 {orig} 没有配色映射'
                slot.material = flat(MAT_MAP[key])


def bbox_world(ob):
    pts = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
    mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return mn, mx


def axis_val(which, mn, mx, i):
    return {'min': mn[i], 'max': mx[i], 'center': (mn[i] + mx[i]) / 2}[which]


def place_group(spec, room):
    """复制组内对象，按 rotY+target 摆到房间坐标，返回副本列表。"""
    dups = []
    for src_name, out_name in spec['objs'].items():
        src = bpy.data.objects[src_name]
        dup = src.copy()   # 共享 mesh data（材质已全局换平涂）
        dup.name = out_name
        dup.hide_render = False
        bpy.context.scene.collection.objects.link(dup)
        if out_name in NAV_IGNORE:
            dup['nav_ignore'] = True
        dups.append(dup)

    # 组 bbox（用源对象世界坐标）
    mn = Vector((1e9, 1e9, 1e9))
    mx = Vector((-1e9, -1e9, -1e9))
    for src_name in spec['objs']:
        a, b = bbox_world(bpy.data.objects[src_name])
        for i in range(3):
            mn[i] = min(mn[i], a[i])
            mx[i] = max(mx[i], b[i])
    ref = Vector((axis_val(spec['ref'][0], mn, mx, 0),
                  axis_val(spec['ref'][1], mn, mx, 1), 0))
    tx, tz = spec['target']
    # three(x,z) → blender(x, -z)；rotY → 绕 blender Z
    M = (Matrix.Translation((tx, -tz, 0))
         @ Matrix.Rotation(math.radians(spec['rotY']), 4, 'Z')
         @ Matrix.Translation(-ref))
    for dup in dups:
        dup.matrix_world = M @ dup.matrix_world

    if spec.get('snap_floor'):
        low = min(bbox_world(d)[0].z for d in dups)
        for dup in dups:
            dup.matrix_world = Matrix.Translation((0, 0, -low)) @ dup.matrix_world
    return dups


def add_room_helpers(room, floor_mat, spawn_mat):
    """校验渲染用：灰地板（房间范围）+ 红块（spawn 落点）。"""
    helpers = []
    w, d = room['w'], room['d']
    bpy.ops.mesh.primitive_plane_add(size=2, location=(0, -d / 2, 0))
    floor = bpy.context.active_object
    floor.name = 'DEBUG_floor'
    floor.scale = (w / 2, d / 2, 1)
    floor.data.materials.append(floor_mat)
    helpers.append(floor)
    for i, (sx, sz) in enumerate(room['spawns']):
        bpy.ops.mesh.primitive_cube_add(size=0.3, location=(sx, -sz, 0.05))
        m = bpy.context.active_object
        m.name = f'DEBUG_spawn{i}'
        m.data.materials.append(spawn_mat)
        helpers.append(m)
    return helpers


def render_check(room, dups, helpers):
    """Workbench 顶视 + 西南鸟瞰，材质色模式。"""
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.display.shading.light = 'FLAT'
    scene.display.shading.color_type = 'MATERIAL'
    scene.render.resolution_x = 800
    scene.render.resolution_y = 800
    cam_data = bpy.data.cameras.new('CheckCam')
    cam = bpy.data.objects.new('CheckCam', cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    w, d = room['w'], room['d']

    def look_at(target):
        direction = Vector(target) - cam.location
        cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()

    # 顶视（ortho）：blender 顶视 = room 俯视
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = max(w, d) + 1.5
    cam.location = (0, -d / 2, 15)
    cam.rotation_euler = (0, 0, 0)
    scene.render.filepath = os.path.join(ROOT, 'temp', f"cgf_{room['id']}_top.png")
    bpy.ops.render.render(write_still=True)
    # 西南鸟瞰（从房间南门一侧看进去：room(0, h, -d*0.9) → blender(0, d*0.9, h)）
    cam_data.type = 'PERSP'
    cam_data.lens = 35
    cam.location = (w * 0.75, d * 0.9, w * 0.85)
    look_at((0, -d * 0.45, 0.3))
    scene.render.filepath = os.path.join(ROOT, 'temp', f"cgf_{room['id']}_iso.png")
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam)
    bpy.data.cameras.remove(cam_data)


def main():
    remap_materials()
    # 校验渲染只看副本：原始 changjing 对象全部隐藏
    for ob in bpy.context.scene.objects:
        ob.hide_render = True
    floor_mat = make_flat_material('MAT_debug_floor', '#9AA0A6')
    spawn_mat = make_flat_material('MAT_debug_spawn', '#C0392B')
    for room in ROOMS:
        dups = []
        for g in room['groups']:
            dups.extend(place_group(g, room))
        helpers = add_room_helpers(room, floor_mat, spawn_mat)
        render_check(room, dups, helpers)

        bpy.ops.object.select_all(action='DESELECT')
        for dup in dups:
            dup.select_set(True)
        out = os.path.join(OUT_DIR, room['file'])
        bpy.ops.export_scene.gltf(
            filepath=out, export_format='GLB', use_selection=True,
            export_apply=True, export_animations=False,
            export_skins=False, export_morph=False)
        faces = sum(len(d.data.polygons) for d in dups)
        print(f"[changjing] {room['file']}: {len(dups)} 件, {faces} 面, "
              f"{os.path.getsize(out) / 1024:.0f} KB")

        for ob in dups + helpers:
            bpy.data.objects.remove(ob)


main()
