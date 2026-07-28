"""在 house-split.blend 的两个正门洞安装门板，并导出 house.glb。

两个正门洞（西翼 + 东翼南面，probe 实测，关于 x=0 对称）:
  - 开口 x: ±(5.95 ~ 7.09)（宽 ~1.15m），z: 0 ~ 2.3（过梁下沿）
  - 墙体 y: -4.05 ~ -3.85（厚 0.2m）
门板: 宽 1.13 × 厚 0.05 × 高 2.28，origin 在铰链底边，向屋外（-y）平开 90°。
  - DOOR_entrance      西门，铰链在西侧门框(x=-7.085)，门板向 +x 延伸
  - DOOR_entrance_east 东门，铰链在东侧门框(x=+7.085)，门板向 -x 延伸
规范见 doc/blender-workflow-instructions.md 二。

用法: tools/blender.sh -b models_src/house-split.blend --python tools/add_door.py
"""
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from flat_materials import make_flat_material

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_BLEND = os.path.join(ROOT, 'models_src', 'house-split.blend')
OUT_GLB = os.path.join(ROOT, 'models', 'house.glb')

WIDTH, THICK, HEIGHT = 1.13, 0.05, 2.28

# (名字, 铰链 x, 门板延伸方向 +1=向+x/-1=向-x, door_swing_dir)
# dir 决定旋转正负（doors.js: left=-1/right=+1），这里取朝屋外（-y）开
DOORS = [
    ('DOOR_entrance',      -7.085, +1, 'left'),
    ('DOOR_entrance_east', +7.085, -1, 'right'),
]

# 材质（split_house 时门分类为空，MAT_door 可能因无使用者被清除，缺则重建）
mat = bpy.data.materials.get('MAT_door')
if mat is None:
    mat = make_flat_material('MAT_door', '#8A5A3B')

for name, hinge_x, extend, swing_dir in DOORS:
    # 幂等：删掉旧门
    old = bpy.data.objects.get(name)
    if old:
        bpy.data.objects.remove(old, do_unlink=True)

    hinge = Vector((hinge_x, -3.95, 0.02))   # 铰链底角（世界坐标）

    bpy.ops.mesh.primitive_cube_add(size=1, location=hinge)
    door = bpy.context.active_object
    door.name = name
    door.scale = (WIDTH, THICK, HEIGHT)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    # 此时顶点是以铰链为中心的世界坐标；转成铰链局部，门板从铰链边向 extend 方向延伸
    for v in door.data.vertices:
        v.co -= hinge
        v.co.x += extend * WIDTH / 2     # extend=+1: x 0~W；extend=-1: x -W~0
        v.co.z += HEIGHT / 2             # z: 0~HEIGHT，铰链在底边
    door.location = hinge
    door.data.materials.append(mat)

    # Custom Properties（glTF 导出为 extras → three.js userData）
    door['interactable_type'] = 'door'
    door['door_swing_angle'] = 90.0      # 平开最大角度（度）
    door['door_swing_dir'] = swing_dir   # 向屋外（-y）开
    door['door_slide'] = False
    door['door_locked'] = False
    print(f'门已安装: {name} hinge_x={hinge_x} dir={swing_dir}')

bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND, check_existing=False)
bpy.ops.export_scene.gltf(
    filepath=OUT_GLB, export_format='GLB',
    export_apply=True, export_animations=False, export_yup=True,
    export_extras=True,   # 必须：否则 custom properties 丢失
)
print(f'已保存 {OUT_BLEND}')
print(f'已导出 {OUT_GLB}')
