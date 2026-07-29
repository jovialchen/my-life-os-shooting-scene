"""探测楼梯：斜面（0.25<nz<0.9）聚类 + 区域内竖直面分布
用法: blender -b models_src/house-split.blend --python tools/probe_stairs.py
"""
import bpy
from collections import Counter

for o in bpy.data.objects:
    if o.type != 'MESH':
        continue
    mw = o.matrix_world
    rot = mw.to_3x3()
    cells = Counter()
    for p in o.data.polygons:
        nz = (rot @ p.normal).normalized().z
        if not 0.25 < nz < 0.9:
            continue
        c = mw @ p.center
        if c.z < 0.3 or c.z > 6.3:
            continue
        cells[(round(c.x), round(c.y), round(c.z * 2) / 2)] += 1
    if cells:
        print(f'== {o.name} sloped ==')
        for cell, cnt in sorted(cells.items(), key=lambda kv: (kv[0][2], kv[0][0])):
            print('   ', cell, cnt)
