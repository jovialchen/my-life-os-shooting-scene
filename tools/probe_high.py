"""列出 house.blend 中完全位于 z>6 的连通块及其分类，评估"高处即屋顶"规则的影响面。

用法: tools/blender.sh -b models_src/house.blend --python tools/probe_high.py
"""
import os
import sys
from collections import Counter

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from split_house import find_components, classify


def main():
    obj = next(o for o in bpy.data.objects if o.type == 'MESH')
    comps = find_components(obj)
    cnt = Counter()
    interesting = []
    for comp, s in comps:
        if s['mins'].z <= 6.0:
            continue
        cat = classify(s)
        cnt[cat] += 1
        if cat != 'roof':
            sz = s['size']
            interesting.append((
                cat,
                tuple(round(v, 2) for v in s['mins']),
                tuple(round(v, 2) for v in s['maxs']),
                tuple(round(v, 2) for v in sz),
                s['n'], round(s['up'], 2)))
    print('z>6 块分类统计:', dict(cnt))
    print(f'非 roof 的 {len(interesting)} 块:')
    for it in sorted(interesting):
        print(f'  {it[0]:7s} bbox={it[1]}~{it[2]} sz={it[3]} faces={it[4]} up={it[5]}')


main()
