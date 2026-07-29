"""定位缝隙的定向渲染（Workbench）。

用法: "$BLEND" -b models_src/house-split.blend --python tools/render_slit.py -- <前缀>
"""
import os
import sys

import bpy
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tools', 'preview')
os.makedirs(OUT, exist_ok=True)

PREFIX = 's'
if '--' in sys.argv:
    PREFIX = sys.argv[sys.argv.index('--') + 1]

cam_data = bpy.data.cameras.new('Cam')
cam = bpy.data.objects.new('Cam', cam_data)
bpy.context.scene.collection.objects.link(cam)
bpy.context.scene.camera = cam
cam_data.lens = 35

scene = bpy.context.scene
scene.render.engine = 'BLENDER_WORKBENCH'
scene.display.shading.light = 'STUDIO'
scene.display.shading.color_type = 'TEXTURE'
scene.render.resolution_x = 900
scene.render.resolution_y = 700


def look_at(obj, target):
    d = target - obj.location
    obj.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()


views = {
    # 西翼南面底层（门+左侧区域），对应 4.png 圈的位置
    'westdoor': (Vector((-6.6, -10, 1.6)), Vector((-6.6, -4, 1.4))),
    # 中央上层墙(-1.0) 正面平视，找竖缝
    'upper2f': (Vector((0, -9, 4.6)), Vector((0, -1, 4.6))),
    # 上层墙从右前下方斜看（对应 5.png 角度）
    'upper2f_ang': (Vector((4.5, -10, 2.0)), Vector((-1.5, -1, 5.0))),
    # 凹槽西内角近距离
    'corner_w': (Vector((-1.5, -8, 3.0)), Vector((-3.6, -2, 4.5))),
    # 复刻 5.png：从左前下方看中央凹墙+屋檐
    'app5': (Vector((-6, -10, 1.5)), Vector((1.5, -1, 5.2))),
    # 复刻 5.png 备选：更近
    'app5b': (Vector((-3, -8, 2.0)), Vector((1.5, -1, 5.0))),
}
for name, (loc, target) in views.items():
    cam.location = loc
    look_at(cam, target)
    scene.render.filepath = os.path.join(OUT, f'{PREFIX}_{name}.png')
    bpy.ops.render.render(write_still=True)
    print(f'渲染 {scene.render.filepath}')
print('完成')
