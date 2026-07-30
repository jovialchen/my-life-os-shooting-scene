"""渲染岛屿花园预览（含房子做参照），验收地形/石板路/植被效果。

用法: tools/blender.sh -b models_src/island.blend --python tools/render_island_preview.py
"""
import math
import os

import bpy
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tools', 'preview')
os.makedirs(OUT, exist_ok=True)

# 导入房子做参照（门窗/比例）
bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT, 'models', 'house.glb'))

cam_data = bpy.data.cameras.new('Cam')
cam = bpy.data.objects.new('Cam', cam_data)
bpy.context.scene.collection.objects.link(cam)
bpy.context.scene.camera = cam

sun_data = bpy.data.lights.new('Sun', type='SUN')
sun_data.energy = 4.0
sun = bpy.data.objects.new('Sun', sun_data)
sun.rotation_euler = (math.radians(50), 0, math.radians(30))
bpy.context.scene.collection.objects.link(sun)

world = bpy.data.worlds.new('W')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (0.75, 0.82, 0.9, 1)
bpy.context.scene.world = world

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 32
scene.render.resolution_x = 1280
scene.render.resolution_y = 800


def look_at(obj, target):
    d = Vector(target) - obj.location
    obj.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()


# (文件名, 相机位置, 目标点)
VIEWS = [
    ('island_garden_top.png',   (0, -5, 55),    (0, -5, 0)),      # 俯视全岛
    ('island_garden_sw.png',    (-22, -28, 9),  (0, -2, 1)),      # 西南低空
    ('island_garden_path.png',  (3, -14, 2.2),  (-2, -5, 0.5)),   # 支路视角
    ('island_garden_east.png',  (26, -12, 7),   (0, 0, 1)),       # 东侧看环路
]

for name, loc, target in VIEWS:
    cam.location = loc
    look_at(cam, target)
    scene.render.filepath = os.path.join(OUT, name)
    bpy.ops.render.render(write_still=True)
    print('rendered', name)
