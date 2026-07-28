"""探测竖梁连通块的几何分布，用于设计"隔一根删一根"的分组逻辑。

用法: tools/blender.sh -b models_src/house.blend --python tools/probe_vbars.py
"""
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from split_house import find_components, classify


def main():
    obj = next(o for o in bpy.data.objects if o.type == 'MESH')
    comps = find_components(obj)
    bars = []
    for comp, s in comps:
        if classify(s) != 'trim':
            continue
        sz = s['size']
        if sz.z > 1.5 and max(sz.x, sz.y) < 0.6:
            cx = (s['mins'].x + s['maxs'].x) / 2
            cy = (s['mins'].y + s['maxs'].y) / 2
            cz = (s['mins'].z + s['maxs'].z) / 2
            bars.append((cx, cy, cz, sz.x, sz.y, sz.z, s['n']))
    print(f'竖梁数量: {len(bars)}')
    bars.sort(key=lambda b: (round(b[1], 1), b[0]))
    for b in bars:
        print(f'c=({b[0]:7.3f},{b[1]:7.3f},{b[2]:5.2f}) '
              f'sz=({b[3]:.3f},{b[4]:.3f},{b[5]:.2f}) faces={b[6]}')


main()
