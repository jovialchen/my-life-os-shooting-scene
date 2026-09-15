"""changjing.blend 分区渲染（Workbench 平光），用于人工识别家具。

用法: tools/blender.sh -b changjing.blend -P tools/render_changjing.py
输出 temp/cg_*.png；OBJECT 配色模式的对照表写 temp/cg_objcolors.txt
"""
import os

import bpy
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'temp')
os.makedirs(OUT, exist_ok=True)

SCENE = bpy.context.scene
SCENE.render.engine = 'BLENDER_WORKBENCH'
SCENE.display.shading.light = 'FLAT'
SCENE.display.shading.color_type = 'OBJECT'   # 每物体一色，配合对照表识别
SCENE.render.resolution_x = 900
SCENE.render.resolution_y = 700

cam_data = bpy.data.cameras.new('ProbeCam')
cam = bpy.data.objects.new('ProbeCam', cam_data)
SCENE.collection.objects.link(cam)
SCENE.camera = cam

STRUCTURAL = {'Plane', 'Plane.006'}

# 每物体一色
COLORS = {}
palette = [(0.95, 0.2, 0.2), (0.2, 0.9, 0.2), (0.2, 0.4, 0.95), (0.95, 0.9, 0.2),
           (0.9, 0.3, 0.9), (0.2, 0.9, 0.9), (0.95, 0.6, 0.2), (0.6, 0.3, 0.9),
           (0.4, 0.9, 0.5), (0.9, 0.5, 0.6), (0.5, 0.5, 0.95), (0.7, 0.7, 0.2),
           (0.2, 0.6, 0.3), (0.8, 0.2, 0.5), (0.3, 0.8, 0.8), (0.6, 0.6, 0.6)]
lines = []
for i, ob in enumerate(sorted(bpy.data.objects, key=lambda o: o.name)):
    if ob.type != 'MESH':
        continue
    c = palette[i % len(palette)]
    ob.color = (c[0], c[1], c[2], 1.0)
    lines.append(f'{ob.name}\tRGB({c[0]:.2f},{c[1]:.2f},{c[2]:.2f})')
with open(os.path.join(OUT, 'cg_objcolors.txt'), 'w') as f:
    f.write('\n'.join(lines) + '\n')


def look_at(obj, target):
    d = target - obj.location
    obj.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()


def render(name, bmin, bmax, direction=(1.0, -1.2, 1.0), ortho=False, hide_struct=True,
           zoom=1.15):
    for ob in bpy.data.objects:
        if ob.type != 'MESH':
            continue
        ob.hide_render = hide_struct and ob.name in STRUCTURAL
    mn, mx = Vector(bmin), Vector(bmax)
    ctr = (mn + mx) / 2
    diag = (mx - mn).length
    cam_data.type = 'ORTHO' if ortho else 'PERSP'
    if ortho:
        cam_data.ortho_scale = max(mx.x - mn.x, mx.y - mn.y, mx.z - mn.z) * 1.25
        d = Vector(direction).normalized()
        cam.location = ctr + d * (diag * 3)
    else:
        cam_data.lens = 32
        d = Vector(direction).normalized()
        cam.location = ctr + d * (diag * zoom)
    look_at(cam, ctr)
    SCENE.render.filepath = os.path.join(OUT, f'cg_{name}.png')
    bpy.ops.render.render(write_still=True)
    print('渲染', SCENE.render.filepath)


# 全屋俯视（含墙体）
render('all_top', (-8.5, -8.5, -0.6), (6.2, 4.5, 3.0), direction=(0, 0, 1), ortho=True,
       hide_struct=True)
render('all_top_struct', (-8.5, -8.5, -0.6), (6.2, 4.5, 3.0), direction=(0, 0, 1),
       ortho=True, hide_struct=False)
render('all_se', (-8.5, -8.5, -0.2), (6.2, 4.5, 3.0), direction=(1.0, -1.0, 0.85))

# 卫生间（km mandi 地面区 x[-6.8,-3.0] y[0.5,3.6]）+ 浴缸(x-7.9..-6.7) + 洗手台/镜子(北墙)
render('bath_top', (-8.2, 0.2, -0.2), (-2.6, 4.2, 2.2), direction=(0, 0, 1), ortho=True)
render('bath_s', (-8.2, 0.2, -0.2), (-2.6, 4.2, 2.2), direction=(0.15, -1.0, 0.55))
render('bath_w', (-8.2, 0.2, -0.2), (-2.6, 4.2, 2.2), direction=(-1.0, -0.35, 0.5))

# 中岛/长桌块（木头 Cube.012 x-1.3..0.76 y0.69..3.88）
render('block_top', (-1.8, 0.3, -0.2), (1.3, 4.2, 1.4), direction=(0, 0, 1), ortho=True)
render('block_s', (-1.8, 0.3, -0.2), (1.3, 4.2, 1.4), direction=(0.2, -1.0, 0.6))

# 西南角（Cube.001 高玻璃柜 / Cube.002 长沙发 / Cube.003 疑似坐便 / Torus）
render('sw_top', (-8.3, -8.3, -0.2), (-4.0, -2.6, 2.4), direction=(0, 0, 1), ortho=True)
render('sw_e', (-8.3, -8.3, -0.2), (-4.0, -2.6, 2.4), direction=(1.0, -0.3, 0.5))

# 客厅（沙发组 x-1.2..4.7 y-5..3.7 + 电视 y-0.8）
render('living_top', (-1.8, -5.5, -0.2), (5.2, 4.2, 2.0), direction=(0, 0, 1), ortho=True)
render('living_sw', (-1.8, -5.5, -0.2), (5.2, 4.2, 2.0), direction=(-0.6, 0.8, 0.55))

# 南侧一组（Cube.025/026/039/040/041/042 木质 + 黑件，y-7.5..-6.2）
render('south_top', (1.0, -8.0, -0.6), (5.2, -5.9, 1.2), direction=(0, 0, 1), ortho=True)
render('south_n', (1.0, -8.0, -0.6), (5.2, -5.9, 1.2), direction=(0.2, 1.0, 0.6))

# 西墙中段（Cube.006/007 双柜 + Cylinder.004/028 玻璃 + Sphere）
render('wmid_top', (-8.3, -3.0, -0.2), (-6.8, 0.2, 1.2), direction=(0, 0, 1), ortho=True)
render('wmid_e', (-8.3, -3.0, -0.2), (-6.8, 0.2, 1.2), direction=(1.0, -0.3, 0.55))

# 立柜/家电列（Plane.003/004/005 metal x-5.6..-4.2 y-7.3..-4.7）
render('appl_top', (-6.0, -7.6, -0.2), (-3.9, -4.4, 1.2), direction=(0, 0, 1), ortho=True)
render('appl_e', (-6.0, -7.6, -0.2), (-3.9, -4.4, 1.2), direction=(1.0, -0.4, 0.5))
print('完成')
