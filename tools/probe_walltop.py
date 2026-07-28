"""列出 WALL_01 / TRIM_01 中 z 达到屋檐高度(maxs.z>6.0)的连通块。

用法: tools/blender.sh -b models_src/house-split.blend --python tools/probe_walltop.py
"""
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from split_house import find_components


def main():
    for obj in bpy.data.objects:
        if obj.type != 'MESH' or obj.name not in ('WALL_01', 'TRIM_01'):
            continue
        comps = find_components(obj)
        hits = []
        for comp, s in comps:
            if s['maxs'].z > 6.0:
                cx = (s['mins'].x + s['maxs'].x) / 2
                cy = (s['mins'].y + s['maxs'].y) / 2
                hits.append((round(cy, 2), round(cx, 2),
                             tuple(round(v, 2) for v in s['mins']),
                             tuple(round(v, 2) for v in s['maxs']),
                             s['n']))
        print(f'== {obj.name}: {len(hits)} 块 maxs.z>6.0')
        for h in sorted(hits):
            print(f'  cy={h[0]:6.2f} cx={h[1]:6.2f} '
                  f'bbox={h[2]}~{h[3]} faces={h[4]}')


main()
