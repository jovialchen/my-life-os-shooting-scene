"""Workbench 平光渲染阁楼内部，快速验证天花板/地板颜色（无需灯光）。

用法: tools/blender.sh -b models_src/house-split.blend --python tools/render_attic_wb.py
"""
import os

import bpy
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tools', 'preview')

cam_data = bpy.data.cameras.new('Cam')
cam = bpy.data.objects.new('Cam', cam_data)
bpy.context.scene.collection.objects.link(cam)
bpy.context.scene.camera = cam

scene = bpy.context.scene
scene.render.engine = 'BLENDER_WORKBENCH'
scene.display.shading.light = 'STUDIO'
scene.display.shading.color_type = 'TEXTURE'  # 平涂材质按本色显示
scene.render.resolution_x = 900
scene.render.resolution_y = 600
scene.render.film_transparent = False


def look_at(obj, target):
    d = target - obj.location
    obj.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()


views = {
    'attic_wb_inside':  (Vector((-6, 0, 7.6)), Vector((5, 0, 8.6))),
    'attic_wb_ceiling': (Vector((2, 2, 6.8)), Vector((-2, -1, 11))),
    'attic_wb_floor':   (Vector((0, 1, 10.5)), Vector((0, -1, 6.2))),
}
for name, (loc, target) in views.items():
    cam.location = loc
    look_at(cam, target)
    scene.render.filepath = os.path.join(OUT, f'{name}.png')
    bpy.ops.render.render(write_still=True)
    print(f'渲染 {scene.render.filepath}')
print('完成')
