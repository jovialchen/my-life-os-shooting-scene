"""渲染验证 0729 改动：一楼地板色 / 白楼梯(补全+黑楼梯已删) / 窗框新色。
用法: blender -b models_src/house-split.blend --python tools/render_check_0729.py
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
    # 后厅看白楼梯（应看到完整白色第一跑，无黑色窄楼梯）
    'chk_stairs_1f': ((2.5, -1.0, 1.8), (-3.0, 4.2, 1.6)),
    # 2F 俯看楼梯顶（补的 5 级踏步 + 东侧出口）
    'chk_stairs_2f': ((2.0, 0.5, 4.5), (-1.5, 4.2, 2.6)),
    # 西翼 1F 室内看地板（应为木色，不再是白色）
    'chk_floor_west': ((-6.8, -2.5, 1.7), (-2.0, 1.5, 0.1)),
    # 东翼 1F 室内看地板
    'chk_floor_east': ((6.8, -2.5, 1.7), (2.0, 1.5, 0.1)),
    # 正立面（南）：窗框应为胡桃棕，与米白墙面对比
    'chk_frame_south': ((0, -16, 4.0), (0, -4.5, 3.0)),
    # 东翼 exterior 窗框近景
    'chk_frame_east': ((12, -8, 3.0), (7.0, -2.0, 2.0)),
}

for name, (loc, look) in VIEWS.items():
    cam.location = loc
    d = Vector(look) - Vector(loc)
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    cam_data.angle = math.radians(70)
    scene.render.filepath = os.path.join(OUT, f'{name}.png')
    bpy.ops.render.render(write_still=True)
    print('渲染', scene.render.filepath)
