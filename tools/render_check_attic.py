"""渲染验证 2F->阁楼第二跑楼梯：坡面/平台/阁楼开口是否建成、有无悬浮穿插。
用法: blender -b models_src/house-split.blend --python tools/render_check_attic.py
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
    # 2F 中厅向西看第二跑（应看到完整踏步从 2F 升到阁楼）
    'chk_a2_from_2f': ((2.0, 0.0, 4.6), (-3.5, 4.2, 4.4)),
    # 阁楼内站立高度向北俯看顶部平台/井口（平台 + 阁楼楼板开口）
    'chk_a2_landing': ((0.8, 0.5, 7.8), (-1.2, 4.4, 6.1)),
    # 阁楼内向东看井口东侧楼板（平台->阁楼楼板的衔接）
    'chk_a2_attic_east': ((-2.5, 0.5, 7.2), (1.5, 4.3, 6.1)),
    # 后厅 1F 仰望两跑（第一跑与第二跑上下叠置关系）
    'chk_a2_both': ((2.5, -1.5, 1.6), (-3.0, 4.2, 3.4)),
    # 北侧室外俯看井道条带（剖视效果看两跑与楼板开口）
    'chk_a2_strip': ((-2.0, 10.0, 8.5), (-2.5, 4.0, 3.2)),
}

for name, (loc, look) in VIEWS.items():
    cam.location = loc
    d = Vector(look) - Vector(loc)
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    cam_data.angle = math.radians(70)
    scene.render.filepath = os.path.join(OUT, f'{name}.png')
    bpy.ops.render.render(write_still=True)
    print('渲染', scene.render.filepath)
