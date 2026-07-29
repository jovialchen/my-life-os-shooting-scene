"""渲染中厅楼梯区域（Workbench 平色）
用法: blender -b models_src/house-split.blend --python tools/render_stairs.py
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

scene = bpy.context.scene
scene.render.engine = 'BLENDER_WORKBENCH'
scene.display.shading.light = 'FLAT'
scene.display.shading.color_type = 'MATERIAL'
scene.render.resolution_x = 900
scene.render.resolution_y = 700
scene.render.film_transparent = False
world = bpy.data.worlds.new('W')
scene.world = world
world.color = (0.05, 0.05, 0.05)

VIEWS = {
    # 后厅看楼梯井（A段+平台+B段）
    'stair_hall': ((1.5, 0.5, 1.7), (-1.2, 4.0, 1.8)),
    # 从 2F 俯看楼梯井
    'stair_2f': ((1.0, 1.5, 4.3), (-1.0, 4.2, 1.0)),
    # 从阁楼俯看（检查删除区域无破洞）
    'stair_top': ((-1.0, 3.8, 8.0), (-1.0, 3.8, 0.0)),
}

for name, (loc, look) in VIEWS.items():
    cam.location = loc
    d = Vector(look) - Vector(loc)
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    cam_data.angle = math.radians(70)
    scene.render.filepath = os.path.join(OUT, f'{name}.png')
    bpy.ops.render.render(write_still=True)
    print('渲染', scene.render.filepath)
