"""西翼/东翼 1F 地板(z<0.25, 朝上)在各对象中的面数分布。"""
import bpy
from collections import Counter
cnt = Counter()
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
        if c.z >= 0.25:
            continue
        region = 'west' if c.x < -4 else ('east' if c.x > 4 else 'mid')
        cnt[(o.name, region)] += 1
for k, v in sorted(cnt.items()):
    print(k, v)
