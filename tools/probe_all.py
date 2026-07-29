"""全屋探测：
1. 所有 window 类连通块的 n/area/d3 分布（找实心板 vs 格栅的分界）
2. 所有 trim 类薄竖条(d1<=0.12)的位置（找窗棂 vs 墙柱）
3. trim 类连通块按区域统计（屋内/屋外）

用法: "$BLEND" -b models_src/house.blend --python tools/probe_all.py
"""
import collections
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from split_house import find_components, classify

obj = next(o for o in bpy.data.objects if o.type == 'MESH')
comps = find_components(obj)

print('=== 1. window 类连通块 (n, area, d3) 分布 ===')
hist = collections.Counter()
solid = []
for comp, s in comps:
    if classify(s) != 'window':
        continue
    d1, d2, d3 = sorted([s['size'].x, s['size'].y, s['size'].z])
    hist[(s['n'] // 5 * 5)] += 1
    if s['n'] <= 8:
        solid.append(s)
print('n 分布(向下取整到5):', dict(sorted(hist.items())))
print(f'n<=8 的实心板: {len(solid)} 块')
for s in solid:
    sz = s['size']
    print(f"  n={s['n']} size=({sz.x:.2f},{sz.y:.2f},{sz.z:.2f}) "
          f"at=({s['mins'].x:.2f},{s['mins'].y:.2f},{s['mins'].z:.2f}) "
          f"area={s['area']:.2f}")

print()
print('=== 2. trim 类薄条 (min dim <= 0.12, 非水平大片) ===')
thin = []
for comp, s in comps:
    if classify(s) != 'trim':
        continue
    sz = s['size']
    d1, d2, d3 = sorted([sz.x, sz.y, sz.z])
    if d1 <= 0.12 and d2 <= 0.25:
        thin.append((d3, s))
thin.sort(key=lambda t: -t[0])
print(f'共 {len(thin)} 根, 按最长边排序前 40:')
for d3, s in thin[:40]:
    sz = s['size']
    vert = 'V' if sz.z == max(sz) else 'H'
    print(f"  {vert} n={s['n']:3d} size=({sz.x:5.2f},{sz.y:5.2f},{sz.z:5.2f}) "
          f"at=({s['mins'].x:6.2f},{s['mins'].y:6.2f},{s['mins'].z:5.2f})")

print()
print('=== 3. trim 类连通块 z 分布 ==='
      )
hist = collections.Counter()
for comp, s in comps:
    if classify(s) == 'trim':
        zmid = s['zmid']
        hist['z>6 attic' if zmid > 6 else ('z3-6 2F' if zmid > 3 else 'z<3 1F')] += 1
print(dict(hist))
