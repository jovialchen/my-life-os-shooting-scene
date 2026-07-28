"""重新导入 models/island.glb（+ house.glb 作参照）并渲染预览图。

同时打印：对象清单及 custom properties、WALK 顶面世界包围盒、房子 footprint、
每棵树离房子的最近距离——用于人工核对。

用法:
  "/c/Program Files/Blender Foundation/Blender 5.1/blender.exe" -b --python tools/render_island.py
"""
import math
import os

import bpy
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tools', 'preview')
os.makedirs(OUT, exist_ok=True)

# 1. 导入 GLB（全新空场景）
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT, 'models', 'island.glb'))
island_objs = list(bpy.context.scene.objects)
bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT, 'models', 'house.glb'))
house_objs = [o for o in bpy.context.scene.objects if o not in island_objs]

# 2. 打印对象清单 + custom props
print('== island.glb 对象 ==')
for o in island_objs:
    if o.type == 'MESH':
        props = {k: o[k] for k in o.keys()}
        print(f'  {o.name:22s} props={props}')

# 3. 世界包围盒工具
def world_bbox(objs):
    pts = []
    for o in objs:
        if o.type == 'MESH':
            for v in o.bound_box:
                pts.append(o.matrix_world @ Vector(v))
    mins = Vector((min(p[i] for p in pts) for i in range(3)))
    maxs = Vector((max(p[i] for p in pts) for i in range(3)))
    return mins, maxs

walk = bpy.data.objects['WALK_island_top']
wmins, wmaxs = world_bbox([walk])
print(f'WALK_island_top bbox: {tuple(wmins)} ~ {tuple(wmaxs)}')
print(f'  → Blender 中心=({(wmins.x+wmaxs.x)/2}, {(wmins.y+wmaxs.y)/2}) '
      f'半径={(wmaxs.x-wmins.x)/2:.2f} 顶面 z={wmaxs.z:.3f}')

hmins, hmaxs = world_bbox(house_objs)
print(f'house.glb bbox: x[{hmins.x:.1f},{hmaxs.x:.1f}] '
      f'y[{hmins.y:.1f},{hmaxs.y:.1f}] z[{hmins.z:.1f},{hmaxs.z:.1f}]')

# 4. 树与房子最近距离（XZ 平面，用包围盒近似）
print('== 树离房距离 ==')
for o in island_objs:
    if o.name.endswith('_trunk'):
        t = o.matrix_world.translation
        dx = max(0.0, max(t.x - hmaxs.x, hmins.x - t.x))
        dy = max(0.0, max(t.y - hmaxs.y, hmins.y - t.y))
        print(f'  {o.name}: 距房 {math.hypot(dx, dy):.1f}m')

# 5. 相机 + 灯光 + 世界
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
world.node_tree.nodes['Background'].inputs[0].default_value = (0.75, 0.82, 0.9, 1)
bpy.context.scene.world = world

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.cycles.use_denoising = False
scene.render.resolution_x = 1000
scene.render.resolution_y = 700

def look_at(obj, target):
    d = target - obj.location
    obj.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()

center = Vector((0, -5, 0))  # 岛屿中心（Blender 坐标）
views = {
    # 高空鸟瞰：整体布局（房子+树+岛形）
    'island_overview': (center + Vector((30, -38, 34)), center + Vector((0, 0, -2))),
    # 低角度南侧：看岛屿裙边
    'island_low':      (center + Vector((10, -34, 2.5)), center + Vector((0, 4, -1))),
    # 低角度西侧
    'island_low_west': (center + Vector((-34, -14, 2.5)), center + Vector((4, 4, -1))),
    # 正顶视：核对圆心/半径与房子相对位置
    'island_top':      (center + Vector((0.01, 0.01, 55)), center),
    # 远景侧面：看完整悬浮岛轮廓（裙边内收到尖端）
    'island_profile':  (center + Vector((45, -55, -4)), center + Vector((0, 0, -3))),
}
for name, (loc, tgt) in views.items():
    cam.location = loc
    look_at(cam, tgt)
    scene.render.filepath = os.path.join(OUT, f'{name}.png')
    bpy.ops.render.render(write_still=True)
    print(f'渲染 {scene.render.filepath}')

print('完成')
