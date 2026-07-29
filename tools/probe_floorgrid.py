"""把指定高度的朝上面画成 x/y 占用网格，看楼板/踏步分布。

  blender -b models_src/house-split.blend --python tools/probe_floorgrid.py
"""
import bpy

ZLO, ZHI = 3.05, 3.35   # 2F 楼板带
X0, X1, Y0, Y1 = -8.0, 8.0, -5.5, 5.5
CELL = 0.25

grid = {}
for o in bpy.data.objects:
    if o.type != 'MESH' or o.name.split('_')[0] in ('WALK', 'DOOR'):
        continue
    mw = o.matrix_world
    rot = mw.to_3x3()
    for p in o.data.polygons:
        n = (rot @ p.normal).normalized()
        if n.z < 0.7:
            continue
        c = mw @ p.center
        if not (ZLO < c.z < ZHI):
            continue
        key = (int((c.x - X0) / CELL), int((c.y - Y0) / CELL))
        grid.setdefault(key, o.name[0])  # F/W/T/R/S

nx = int((X1 - X0) / CELL)
ny = int((Y1 - Y0) / CELL)
print(f'z {ZLO}..{ZHI}  每格 {CELL}m  x {X0}..{X1} (列)  y {Y1}..{Y0} (行,上北)')
for gy in range(ny - 1, -1, -1):
    row = ''.join(grid.get((gx, gy), '.') for gx in range(nx))
    print(f'{Y0 + gy * CELL:6.2f} {row}')
