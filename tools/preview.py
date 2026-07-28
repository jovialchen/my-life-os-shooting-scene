"""渲染 house.blend 预览图 + 导出贴图集，用于人工查看。

用法: tools/blender.sh -b models_src/house.blend --python tools/preview.py [blend路径]
"""
import math
import os
import sys

import bpy
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tools', 'preview')
os.makedirs(OUT, exist_ok=True)

argv = sys.argv[sys.argv.index('--python') + 2:] if '--python' in sys.argv else []

# 1. 导出贴图
for img in bpy.data.images:
    if img.name == 'Render Result':
        continue
    try:
        path = os.path.join(OUT, img.name)
        img.save_render(path) if img.is_dirty else None
        if img.packed_file:
            with open(path, 'wb') as f:
                f.write(img.packed_file.data)
            print(f'导出贴图 {path}')
        elif img.filepath:
            src = bpy.path.abspath(img.filepath)
            if os.path.exists(src):
                import shutil
                shutil.copy(src, path)
                print(f'复制贴图 {path}')
    except Exception as e:
        print(f'贴图 {img.name} 导出失败: {e}')

# 2. 场景 bounding box（世界坐标）
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
pts = []
for o in meshes:
    for v in o.bound_box:
        pts.append(o.matrix_world @ Vector(v))
mins = Vector((min(p[i] for p in pts) for i in range(3)))
maxs = Vector((max(p[i] for p in pts) for i in range(3)))
center = (mins + maxs) / 2
size = (maxs - mins).length
print(f'场景 bbox: {tuple(mins)} ~ {tuple(maxs)}, center={tuple(center)}')

# 3. 相机 + 灯光
cam_data = bpy.data.cameras.new('PreviewCam')
cam = bpy.data.objects.new('PreviewCam', cam_data)
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
world.node_tree.nodes['Background'].inputs[1].default_value = 1.0
bpy.context.scene.world = world

# 4. 渲染设置：Cycles CPU 低采样（无头环境 EEVEE 可能无 GL 上下文）
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.cycles.use_denoising = False
scene.render.resolution_x = 800
scene.render.resolution_y = 600
scene.render.film_transparent = False

def look_at(obj, target):
    d = target - obj.location
    obj.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()

dist = size * 0.9
views = {
    'front': center + Vector((0, -dist, dist * 0.35)),
    'back':  center + Vector((0, dist, dist * 0.35)),
    'left':  center + Vector((-dist, 0, dist * 0.35)),
    'right': center + Vector((dist, 0, dist * 0.35)),
    'top':   center + Vector((0.01, 0.01, dist * 1.2)),
    'iso':   center + Vector((dist * 0.7, -dist * 0.7, dist * 0.6)),
}
for name, loc in views.items():
    cam.location = loc
    look_at(cam, center)
    scene.render.filepath = os.path.join(OUT, f'view_{name}.png')
    bpy.ops.render.render(write_still=True)
    print(f'渲染 {scene.render.filepath}')

print('预览完成')
