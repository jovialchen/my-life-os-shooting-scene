"""渲染底层四面近景，找门洞位置。

用法: tools/blender.sh -b models_src/house-split.blend --python tools/ground_views.py
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

world = bpy.data.worlds.new('W')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (0.8, 0.8, 0.85, 1)
bpy.context.scene.world = world

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 16
scene.render.resolution_x = 1000
scene.render.resolution_y = 400

def look_at(obj, target):
    d = target - obj.location
    obj.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()

# 四面低空视角，目标对准底层(z=1.5)
views = {
    'south': (Vector((0, -14, 2.0)), Vector((0, 0, 1.5)), (0, 0, 0)),   # 从 -y 看（正立面）
    'north': (Vector((0, 14, 2.0)),  Vector((0, 0, 1.5)), (0, 0, 0)),
    'west':  (Vector((-16, 0, 2.0)), Vector((0, 0, 1.5)), (0, 0, 0)),
    'east':  (Vector((16, 0, 2.0)),  Vector((0, 0, 1.5)), (0, 0, 0)),
    # 庭院内部视角
    'court': (Vector((0, -2.5, 2.0)), Vector((0, 2.0, 1.5)), (0, 0, 0)),
}
for name, (loc, tgt, _) in views.items():
    cam.location = loc
    look_at(cam, tgt)
    sun.rotation_euler = (math.radians(60), 0,
                          math.atan2(loc.x, loc.y) + math.pi)
    scene.render.filepath = os.path.join(OUT, f'ground_{name}.png')
    bpy.ops.render.render(write_still=True)
    print(f'渲染 {name}')
print('完成')
