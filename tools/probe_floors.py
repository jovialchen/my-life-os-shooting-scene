"""探测楼梯/楼面：所有朝上面（nz>0.85）按 (类别, z层级, 区域) 聚类
用法: blender -b models_src/house-split.blend --python tools/probe_floors.py
"""
import bpy
from collections import Counter

for o in bpy.data.objects:
    if o.type != 'MESH':
        continue
    cat = o.name.split('_')[0]
    mw = o.matrix_world
    rot = mw.to_3x3()
    cells = Counter()
    for p in o.data.polygons:
        nz = (rot @ p.normal).normalized().z
        if nz < 0.85:
            continue
        c = mw @ p.center
        cells[(round(c.x / 2) * 2, round(c.y / 2) * 2, round(c.z * 2) / 2)] += 1
    if cells:
        print(f'== {o.name} ==')
        for cell, cnt in sorted(cells.items(), key=lambda kv: (kv[0][2], kv[0][0])):
            print('   ', cell, cnt)
