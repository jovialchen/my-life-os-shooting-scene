"""探测山墙区域(y<-4.8, z>6)的连通块，看拱肩板/窗格/木条的几何特征。

用法: "$BLEND" -b models_src/house.blend --python tools/probe_gable.py
"""
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from split_house import find_components, classify

obj = next(o for o in bpy.data.objects if o.type == 'MESH')
comps = find_components(obj)

rows = []
for comp, s in comps:
    if s['maxs'].y > -4.8 or s['maxs'].z < 5.5:
        continue
    rows.append((comp, s))

rows.sort(key=lambda cs: (cs[1]['mins'].x, cs[1]['mins'].z))
print(f'{len(rows)} 个连通块在山墙区域')
for comp, s in rows:
    sz = s['size']
    d1, d2, d3 = sorted([sz.x, sz.y, sz.z])
    print(f"n={s['n']:4d} cat={classify(s):6s} "
          f"size=({sz.x:5.2f},{sz.y:5.2f},{sz.z:5.2f}) "
          f"d=({d1:.2f},{d2:.2f},{d3:.2f}) "
          f"x=({s['mins'].x:6.2f},{s['maxs'].x:6.2f}) "
          f"y=({s['mins'].y:6.2f},{s['maxs'].y:6.2f}) "
          f"z=({s['mins'].z:5.2f},{s['maxs'].z:5.2f}) "
          f"up={s['up']:.2f} area={s['area']:5.2f}")
