"""近距渲染背墙屋檐区域，确认白色构件是什么。

用法: tools/blender.sh -b models_src/house-split.blend --python tools/render_eave.py
"""
import math
import os

import bpy
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tools', 'preview')
os.makedirs(OUT, exist_ok=True)

cam_data = bpy.data.cameras.new('Cam')
cam = bpy.data.objects.new('Cam', cam_data)
bpy.context.scene.collection.objects.link(cam)
bpy.context.scene.camera = cam

sun_data = bpy.data.lights.new('Sun', type='SUN')
sun_data.energy = 4.0
sun = bpy.data.objects.new('Sun', sun_data)
bpy.context.scene.collection.objects.link(sun)
sun.rotation_euler = (math.radians(50), 0, math.radians(30))

world = bpy.data.worlds.new('W')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (0.9, 0.9, 0.95, 1)
bpy.context.scene.world = world

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.cycles.use_denoising = False
scene.render.resolution_x = 900
scene.render.resolution_y = 500


def look_at(obj, target):
    d = target - obj.location
    obj.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()


target = Vector((0, 5.0, 6.3))
views = {
    'eave_front': target + Vector((0, 10, -1.5)),   # 正面平视偏下
    'eave_below': target + Vector((2, 8, -5)),      # 从下往上看挑出部分
    'eave_side':  target + Vector((10, 8, 0)),      # 斜侧
}
for name, loc in views.items():
    cam.location = loc
    look_at(cam, target)
    scene.render.filepath = os.path.join(OUT, f'{name}.png')
    bpy.ops.render.render(write_still=True)
    print(f'渲染 {scene.render.filepath}')
print('完成')
