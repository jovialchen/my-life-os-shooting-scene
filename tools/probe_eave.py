"""探测拆分后模型里背墙屋檐区域(y>4.3, z 5.6~7.0)的几何块属于哪个 object。

用法: tools/blender.sh -b models_src/house-split.blend --python tools/probe_eave.py
"""
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from split_house import find_components


def main():
    for obj in bpy.data.objects:
        if obj.type != 'MESH':
            continue
        comps = find_components(obj)
        hits = []
        for comp, s in comps:
            cy = (s['mins'].y + s['maxs'].y) / 2
            cz = (s['mins'].z + s['maxs'].z) / 2
            if cy > 4.3 and 5.6 < cz < 7.0 and max(s['size']) < 2.0:
                cx = (s['mins'].x + s['maxs'].x) / 2
                hits.append((round(cy, 2), round(cx, 2), round(cz, 2),
                             tuple(round(v, 3) for v in s['size']),
                             (tuple(round(v, 2) for v in s['mins']),
                              tuple(round(v, 2) for v in s['maxs']))))
        if hits:
            print(f'== {obj.name}: {len(hits)} 块')
            for h in sorted(hits):
                print(f'  y={h[0]:5.2f} x={h[1]:6.2f} z={h[2]:5.2f} '
                      f'sz={h[3]} bbox={h[4][0]}~{h[4][1]}')


main()
