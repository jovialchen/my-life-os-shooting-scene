"""调试分类：打印各类连通块的详细几何统计。

用法: tools/blender.sh -b models_src/house.blend --python tools/debug_classify.py
"""
import collections
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from split_house import find_components, classify

obj = next(o for o in bpy.data.objects if o.type == 'MESH')
comps = find_components(obj)

by_cat = collections.defaultdict(list)
for comp, s in comps:
    by_cat[classify(s)].append(s)

for cat in ['wall', 'window', 'door', 'trim']:
    ss = by_cat[cat]
    print(f'\n=== {cat}: {len(ss)} 块 ===')
    # 尺寸分布
    hist = collections.Counter()
    for s in ss:
        m = max(s['size'])
        if m < 0.3: hist['<0.3m'] += 1
        elif m < 1.0: hist['0.3-1m'] += 1
        elif m < 2.0: hist['1-2m'] += 1
        elif m < 4.0: hist['2-4m'] += 1
        else: hist['>=4m'] += 1
    print('最大边长:', dict(hist))
    # 打印最大的 20 块
    ss.sort(key=lambda s: -s['n'])
    for s in ss[:20]:
        sz = s['size']
        print(f"  n={s['n']:5d} size=({sz.x:5.2f},{sz.y:5.2f},{sz.z:5.2f}) "
              f"z=({s['mins'].z:5.2f},{s['maxs'].z:5.2f}) up={s['up']*100:3.0f}% "
              f"thin={s['thin']:.2f} area={s['area']:6.2f} "
              f"at=({s['mins'].x:6.2f},{s['mins'].y:6.2f})")
