"""白楼梯近景验证。"""
import math, os
import bpy
from mathutils import Vector
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tools', 'preview')
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
world = bpy.data.worlds.new('W')
scene.world = world
world.color = (0.05, 0.05, 0.05)
VIEWS = {
    # 中厅 1F 看北墙白楼梯全貌
    'chk2_stairs_full': ((0.5, -3.5, 1.7), (-3.5, 4.5, 1.8)),
    # 楼梯下口往上看
    'chk2_stairs_up': ((-6.2, 2.0, 1.6), (-1.5, 4.3, 2.5)),
}
for name, (loc, look) in VIEWS.items():
    cam.location = loc
    d = Vector(look) - Vector(loc)
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    cam_data.angle = math.radians(70)
    scene.render.filepath = os.path.join(OUT, f'{name}.png')
    bpy.ops.render.render(write_still=True)
    print('渲染', scene.render.filepath)
