"""探测屋檐下的斜梁(椽子)连通块：位置、尺寸、当前分类。

用法: tools/blender.sh -b models_src/house.blend --python tools/probe_rafters.py
"""
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from split_house import find_components, classify


def main():
    obj = next(o for o in bpy.data.objects if o.type == 'MESH')
    comps = find_components(obj)
    rows = []
    for comp, s in comps:
        sz = s['size']
        # 椽子：小块,位于屋檐高度(z 5~7),不在屋顶主体里
        if max(sz.x, sz.y, sz.z) > 1.0 and not (0.1 < sz.z < 1.0):
            continue
        if not (4.8 < s['zmid'] < 7.0):
            continue
        cx = (s['mins'].x + s['maxs'].x) / 2
        cy = (s['mins'].y + s['maxs'].y) / 2
        rows.append((round(cy, 2), round(cx, 2), round(s['zmid'], 2),
                     tuple(round(v, 3) for v in (sz.x, sz.y, sz.z)),
                     classify(s), s['n'], round(s['up'], 2)))
    rows.sort()
    print(f'候选小块: {len(rows)}')
    for r in rows:
        print(f'y={r[0]:7.2f} x={r[1]:7.2f} z={r[2]:5.2f} sz={r[3]} '
              f'cat={r[4]:6s} faces={r[5]} up={r[6]}')


main()
