"""渲染客厅 + 家具预览（Workbench 平色，贴近 app 水墨平涂的色块感）。

导入 models/room_living.glb + models/furniture_living.glb，
按 app 客厅两个机位（config.js LIVING_ZONES）各出一张图。

用法: tools/blender.sh -b --python tools/preview_living.py
"""
import os

import bpy
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tools', 'preview')
os.makedirs(OUT, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
for glb in ('room_living.glb', 'furniture_living.glb'):
    bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT, 'models', glb))

scene = bpy.context.scene
scene.render.engine = 'BLENDER_WORKBENCH'
scene.display.shading.light = 'FLAT'
scene.display.shading.color_type = 'MATERIAL'
scene.render.resolution_x = 1280
scene.render.resolution_y = 720
world = bpy.data.worlds.new('W')
scene.world = world
world.color = (0.9, 0.85, 0.75)

cam = bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam'))
scene.collection.objects.link(cam)
scene.camera = cam
cam.data.angle = 0.87   # ~50° FOV，对齐 app


def look_at(obj, target):
    d = target - obj.location
    obj.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()


def t3(p):   # three 坐标 → blender
    return Vector((p[0], -p[2], p[1]))


VIEWS = {
    # 与 config.js LIVING_ZONES 一致
    'living_main':   ([-4.2, 2.7, 1.2], [1.2, 0.5, 6.5]),
    'living_window': ([3.2, 2.5, 10.5], [-2.0, 0.7, 2.0]),
    # 楼梯特写（看踏步/栏杆）
    'living_stairs': ([1.2, 1.6, 3.2], [4.5, 1.8, 8.5]),
    # 沙发组特写（从东北高看西南：沙发正面/茶几/电视柜）
    'living_sofa':   ([3.6, 2.2, 8.2], [1.5, 0.3, 3.2]),
    # 顶视（核对摆位；正交）
    'living_top':    ([0, 20, 6.0], [0, 0, 6.0]),
}
for name, (pos, tgt) in VIEWS.items():
    cam.location = t3(pos)
    look_at(cam, t3(tgt))
    # 顶视时掀掉天花板/井道/窗帘，看平面布局
    if name == 'living_top':
        cam.data.type = 'ORTHO'
        cam.data.ortho_scale = 22   # 垂直覆盖 = 22*720/1280 ≈ 12.4m，看全 z 0..12
        for o in bpy.data.objects:
            if o.name.split('.')[0] in ('CEILING', 'SHAFT', 'CURTAIN_ROD_north',
                                        'CURTAIN_L_north', 'CURTAIN_R_north'):
                o.hide_render = True
    else:
        cam.data.type = 'PERSP'
        for o in bpy.data.objects:
            o.hide_render = False
    scene.render.filepath = os.path.join(OUT, f'{name}.png')
    bpy.ops.render.render(write_still=True)
    print(f'渲染 {name}.png')
