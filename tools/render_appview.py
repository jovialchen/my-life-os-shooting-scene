"""按 app 截图视角渲染背墙：低角度、从左后方看。

用法: tools/blender.sh -b models_src/house-split.blend --python tools/render_appview.py
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

world = bpy.data.worlds.new('W')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (0.6, 0.75, 0.85, 1)
bpy.context.scene.world = world

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.cycles.use_denoising = False
scene.render.resolution_x = 1100
scene.render.resolution_y = 500


def look_at(obj, target):
    d = target - obj.location
    obj.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()


target = Vector((0, 5.0, 4.0))
views = {
    'app_left': target + Vector((-14, 14, -1)),   # 左后方低角度(同 app 截图)
    'app_right': target + Vector((14, 14, -1)),   # 右后方低角度(对照)
}
for name, loc in views.items():
    cam.location = loc
    look_at(cam, target)
    scene.render.filepath = os.path.join(OUT, f'{name}.png')
    bpy.ops.render.render(write_still=True)
    print(f'渲染 {scene.render.filepath}')
print('完成')
