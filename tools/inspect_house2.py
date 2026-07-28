"""世界空间下分析 house.blend 的松散块分布，为分类规则定阈值。

用法: tools/blender.sh -b models_src/house.blend --python tools/inspect_house2.py
"""
import collections

import bpy
import bmesh
from mathutils import Vector

obj = next(o for o in bpy.data.objects if o.type == 'MESH')
mw = obj.matrix_world
print('matrix_world:')
for row in mw:
    print('  ', tuple(round(v, 3) for v in row))

bm = bmesh.new()
bm.from_mesh(obj.data)
bm.faces.ensure_lookup_table()

visited = set()
parts = []
for face in bm.faces:
    if face.index in visited:
        continue
    stack = [face]
    comp = []
    while stack:
        f = stack.pop()
        if f.index in visited:
            continue
        visited.add(f.index)
        comp.append(f)
        for v in f.verts:
            for lf in v.link_faces:
                if lf.index not in visited:
                    stack.append(lf)
    parts.append(comp)

stats = []
for comp in parts:
    pts = [mw @ v.co for f in comp for v in f.verts]
    mins = Vector((min(p[i] for p in pts) for i in range(3)))
    maxs = Vector((max(p[i] for p in pts) for i in range(3)))
    size = maxs - mins
    up = sum(1 for f in comp if (mw.to_3x3() @ f.normal).normalized().z > 0.5)
    stats.append({
        'n': len(comp), 'mins': mins, 'maxs': maxs, 'size': size,
        'up': up / len(comp), 'zmid': (mins.z + maxs.z) / 2,
        'area_est': max(size.x * size.y, size.x * size.z, size.y * size.z),
    })

print(f'\n共 {len(parts)} 个松散块')

# 直方图: 面数
hist = collections.Counter()
for s in stats:
    if s['n'] < 10: hist['<10'] += 1
    elif s['n'] < 50: hist['10-50'] += 1
    elif s['n'] < 100: hist['50-100'] += 1
    elif s['n'] < 200: hist['100-200'] += 1
    else: hist['>=200'] += 1
print('面数分布:', dict(hist))

# 直方图: 最大边长
hist = collections.Counter()
for s in stats:
    m = max(s['size'])
    if m < 0.2: hist['<0.2m'] += 1
    elif m < 0.5: hist['0.2-0.5m'] += 1
    elif m < 1.0: hist['0.5-1m'] += 1
    elif m < 2.0: hist['1-2m'] += 1
    elif m < 4.0: hist['2-4m'] += 1
    else: hist['>=4m'] += 1
print('最大边长分布:', dict(hist))

# 中大型块 (n>=50) 按 zmid 排序打印
big = [s for s in stats if s['n'] >= 50]
big.sort(key=lambda s: -s['n'])
print(f'\n面数>=50 的块共 {len(big)} 个:')
for i, s in enumerate(big):
    sz = s['size']
    print(f"  n={s['n']:5d} size=({sz.x:5.2f},{sz.y:5.2f},{sz.z:5.2f}) "
          f"zmid={s['zmid']:5.2f} up={s['up']*100:3.0f}% "
          f"xy=({s['mins'].x:6.2f},{s['mins'].y:6.2f})~({s['maxs'].x:6.2f},{s['maxs'].y:6.2f})")
    if i >= 80:
        print(f'  ... 省略 {len(big)-81} 个')
        break

bm.free()
