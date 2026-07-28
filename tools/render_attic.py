"""渲染验证阁楼调整：正面山墙外观 + 阁楼内部（天花板/地板）。

用法: tools/blender.sh -b models_src/house-split.blend --python tools/render_attic.py
"""
import math
import os

import bpy
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tools', 'preview')

cam_data = bpy.data.cameras.new('Cam')
cam = bpy.data.objects.new('Cam', cam_data)
bpy.context.scene.collection.objects.link(cam)
bpy.context.scene.camera = cam

sun_data = bpy.data.lights.new('Sun', type='SUN')
sun_data.energy = 4.0
sun = bpy.data.objects.new('Sun', sun_data)
bpy.context.scene.collection.objects.link(sun)
sun.rotation_euler = (math.radians(50), 0, math.radians(30))

# 阁楼内部补光
pl_data = bpy.data.lights.new('AtticLight', type='POINT')
pl_data.energy = 2000
pl = bpy.data.objects.new('AtticLight', pl_data)
pl.location = (0, 0, 9)
bpy.context.scene.collection.objects.link(pl)

world = bpy.data.worlds.new('W')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (0.6, 0.75, 0.85, 1)
bpy.context.scene.world = world

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 32
scene.cycles.use_denoising = False
scene.render.resolution_x = 900
scene.render.resolution_y = 600


def look_at(obj, target):
    d = target - obj.location
    obj.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()


views = {
    # 正面看两翼山墙（粉色圈区域）
    'gable_front': (Vector((0, -22, 8)), Vector((0, -4, 7))),
    # 阁楼内部：从西翼向东看天花板和地板
    'attic_inside': (Vector((-6, 0, 7.6)), Vector((5, 0, 8.6))),
    # 阁楼内部：仰视天花板
    'attic_ceiling': (Vector((2, 2, 6.8)), Vector((-2, -1, 11))),
}
for name, (loc, target) in views.items():
    cam.location = loc
    look_at(cam, target)
    scene.render.filepath = os.path.join(OUT, f'{name}.png')
    bpy.ops.render.render(write_still=True)
    print(f'渲染 {scene.render.filepath}')
print('完成')
