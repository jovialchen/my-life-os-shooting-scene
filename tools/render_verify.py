"""Workbench 平光渲染各问题视角，快速验证颜色/缝隙修复（无需灯光）。

用法: "$BLEND" -b models_src/house-split.blend --python tools/render_verify.py -- <前缀>
输出 tools/preview/<前缀>_<视角>.png
"""
import os
import sys

import bpy
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tools', 'preview')
os.makedirs(OUT, exist_ok=True)

PREFIX = 'v'
if '--' in sys.argv:
    PREFIX = sys.argv[sys.argv.index('--') + 1]

cam_data = bpy.data.cameras.new('Cam')
cam = bpy.data.objects.new('Cam', cam_data)
bpy.context.scene.collection.objects.link(cam)
bpy.context.scene.camera = cam

scene = bpy.context.scene
scene.render.engine = 'BLENDER_WORKBENCH'
scene.display.shading.light = 'FLAT'  # 平光：本色显示，不受朝向影响
scene.display.shading.color_type = 'TEXTURE'  # 平涂材质按本色显示
scene.render.resolution_x = 900
scene.render.resolution_y = 700


def look_at(obj, target):
    d = target - obj.location
    obj.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()


views = {
    # 任务1-3: 东翼山墙近景（对应 0.png/1.png）
    'gable':   (Vector((6.6, -14, 8.6)), Vector((6.6, -5, 8.2))),
    # 任务3: 西翼山墙对照
    'gable_w': (Vector((-6.6, -14, 8.6)), Vector((-6.6, -5, 8.2))),
    # 任务6: 正面底层中央（对应 4.png）
    'front1f': (Vector((0, -13, 1.8)), Vector((0, -4, 1.6))),
    # 任务7: 中央上层+屋檐低角度（对应 5.png）
    'eave':    (Vector((4.5, -13, 2.2)), Vector((0.5, -4, 5.6))),
    # 任务4: 一楼屋内看内墙竖梁（对应 2.png）
    'inside1f': (Vector((-0.5, 1.5, 1.7)), Vector((-7, -2.5, 1.3))),
    # 任务4: 二楼屋内
    'inside2f': (Vector((-0.5, 1.5, 4.6)), Vector((-7, -2.5, 4.2))),
    # 任务5: 阁楼内部（对应 3.png）
    'attic':   (Vector((-6, 0, 7.6)), Vector((5, 0, 8.6))),
    'attic2':  (Vector((2, 2, 6.8)), Vector((-2, -1, 11))),
}
for name, (loc, target) in views.items():
    cam.location = loc
    look_at(cam, target)
    scene.render.filepath = os.path.join(OUT, f'{PREFIX}_{name}.png')
    bpy.ops.render.render(write_still=True)
    print(f'渲染 {scene.render.filepath}')
print('完成')
