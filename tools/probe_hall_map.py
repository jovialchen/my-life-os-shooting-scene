"""中厅占位图：ASCII 地图（. 空 / # 有障碍）
用法: blender -b models_src/house-split.blend --python tools/probe_hall_map.py -- 1f
     blender -b models_src/house-split.blend --python tools/probe_hall_map.py -- 2f
"""
import sys

import bpy
from mathutils import Vector

FLOOR = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else '1f'
Z_LO, Z_HI = (0.25, 2.7) if FLOOR == '1f' else (3.35, 5.8)

dg = bpy.context.evaluated_depsgraph_get()
sc = bpy.context.scene

STEP = 0.25
X0, X1 = -4.0, 4.0
Y0, Y1 = -5.0, 5.4

print(f'== {FLOOR} z {Z_LO}..{Z_HI} ==  行=y（上北下南）列=x，每格 {STEP}m')
y = Y1
while y >= Y0:
    row = ''
    x = X0
    while x <= X1:
        o = Vector((x, y, Z_LO))
        d = Vector((0, 0, 1))
        ok, loc, *_ = sc.ray_cast(dg, o, d, distance=Z_HI - Z_LO)
        row += '#' if ok else '.'
        x += STEP
    print(f'{y:6.2f} {row}')
    y -= STEP
