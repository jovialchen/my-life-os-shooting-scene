"""WALK_floors 可行走面在指定高度的 x/y 占用网格。

  blender -b models_src/house-split.blend --python tools/probe_walkgrid.py
"""
import bpy

import sys
ZLO, ZHI = 0.03, 0.30
X0, X1, Y0, Y1 = -8.0, 8.0, -5.5, 5.5
CELL = 0.25

cells = set()
o = bpy.data.objects.get('WALK_floors')
mw = o.matrix_world
rot = mw.to_3x3()
for p in o.data.polygons:
    n = (rot @ p.normal).normalized()
    if n.z < 0.7:
        continue
    vs = [mw @ o.data.vertices[vi].co for vi in p.vertices]
    xs = [v.x for v in vs]
    ys = [v.y for v in vs]
    cz = sum(v.z for v in vs) / len(vs)
    if not (ZLO < cz < ZHI):
        continue
    # 用面的包围盒覆盖所有格子（面可能跨多格）
    gx0, gx1 = int((min(xs) - X0) / CELL), int((max(xs) - X0) / CELL)
    gy0, gy1 = int((min(ys) - Y0) / CELL), int((max(ys) - Y0) / CELL)
    for gx in range(gx0, gx1 + 1):
        for gy in range(gy0, gy1 + 1):
            cells.add((gx, gy))

nx = int((X1 - X0) / CELL)
ny = int((Y1 - Y0) / CELL)
print(f'WALK z {ZLO}..{ZHI}  x {X0}..{X1} 每格{CELL}m  上行=北(y大)')
for gy in range(ny - 1, -1, -1):
    row = ''.join('#' if (gx, gy) in cells else '.' for gx in range(nx))
    print(f'{Y0 + gy * CELL:6.2f} {row}')
