"""渲染屋顶背面坡面俯视，检查斜梁(屋脊肋条)颜色。

用法: tools/blender.sh -b models_src/house-split.blend --python tools/render_roof.py
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
world.node_tree.nodes['Background'].inputs[0].default_value = (0.9, 0.9, 0.95, 1)
bpy.context.scene.world = world

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.cycles.use_denoising = False
scene.render.resolution_x = 900
scene.render.resolution_y = 600


def look_at(obj, target):
    d = target - obj.location
    obj.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()


target = Vector((0, 3.0, 8.5))
views = {
    'roof_back': target + Vector((0, 12, 6)),    # 背面坡面斜视
    'roof_top':  target + Vector((0, 4, 14)),    # 接近正俯视
}
for name, loc in views.items():
    cam.location = loc
    look_at(cam, target)
    scene.render.filepath = os.path.join(OUT, f'{name}.png')
    bpy.ops.render.render(write_still=True)
    print(f'渲染 {scene.render.filepath}')
print('完成')
