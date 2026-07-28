"""列出拆分后模型中 maxs.z>10 且不在 ROOF_01 里的连通块（屋脊附近的白色残留）。

用法: tools/blender.sh -b models_src/house-split.blend --python tools/probe_ridge.py
"""
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from split_house import find_components


def main():
    for obj in bpy.data.objects:
        if obj.type != 'MESH' or obj.name == 'ROOF_01':
            continue
        comps = find_components(obj)
        hits = []
        for comp, s in comps:
            if s['maxs'].z > 10.0:
                hits.append((tuple(round(v, 2) for v in s['mins']),
                             tuple(round(v, 2) for v in s['maxs']), s['n']))
        if hits:
            print(f'== {obj.name}: {len(hits)} 块 maxs.z>10')
            for h in sorted(hits):
                print(f'  bbox={h[0]}~{h[1]} faces={h[2]}')


main()
