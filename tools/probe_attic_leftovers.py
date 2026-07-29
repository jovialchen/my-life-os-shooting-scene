"""诊断：阁楼范围内仍是 roof/trim 材质的面在哪（task5 残余橙块定位）
用法: blender -b models_src/house-split.blend --python tools/probe_attic_leftovers.py
"""
import bpy
from collections import Counter

for o in bpy.data.objects:
    if o.type != 'MESH' or o.name.split('_')[0] not in ('ROOF', 'TRIM'):
        continue
    mw = o.matrix_world
    cells = Counter()
    n = 0
    for p in o.data.polygons:
        c = mw @ p.center
        if c.z > 6.0 and abs(c.x) < 9.5 and -5.2 < c.y < 5.3:
            n += 1
            cells[(round(c.x), round(c.y), round(c.z))] += 1
    print(o.name, 'leftover attic faces:', n)
    for cell, cnt in sorted(cells.items(), key=lambda kv: -kv[1])[:20]:
        print('   ', cell, cnt)
