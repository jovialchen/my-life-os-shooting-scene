"""阁楼楼梯（2F->阁楼）综合探针：当前 house-split.blend 现状摸底。

A. 第二跑踏步几何（x -5.6..-0.3, y 3.0..5.0, z 3.0..6.4 的朝上面）
B. 阁楼楼板覆盖（z 6.05..6.35 朝上面，全屋范围）
C. 第二跑坡线上方的净空（向上射线）
D. 顶部平台/井口区域所有朝向的面（x -1.6..0.5, y 2.8..5.1, z 5.6..7.2）
E. 从平台向南的射线（跨越 y≈3.18 矮墙/门洞）

  blender -b models_src/house-split.blend --python tools/probe_attic_stair.py
"""
import bpy
from mathutils import Vector

dg = bpy.context.evaluated_depsgraph_get()
sc = bpy.context.scene


def up_faces(x0, x1, y0, y1, z0, z1, title):
    print(f'\n== {title} ==')
    for o in bpy.data.objects:
        if o.type != 'MESH' or o.name.split('_')[0] in ('WALK', 'DOOR'):
            continue
        mw = o.matrix_world
        rot = mw.to_3x3()
        rows = []
        for p in o.data.polygons:
            n = (rot @ p.normal).normalized()
            if n.z < 0.7:
                continue
            vs = [mw @ o.data.vertices[vi].co for vi in p.vertices]
            xs = sorted(v.x for v in vs)
            ys = sorted(v.y for v in vs)
            zs = sorted(v.z for v in vs)
            cx, cy, cz = (xs[0] + xs[-1]) / 2, (ys[0] + ys[-1]) / 2, (zs[0] + zs[-1]) / 2
            if not (x0 < cx < x1 and y0 < cy < y1 and z0 < cz < z1):
                continue
            rows.append((xs[0], xs[-1], ys[0], ys[-1], zs[0], zs[-1]))
        if rows:
            print(f'-- {o.name} ({len(rows)}) --')
            for r in sorted(rows, key=lambda r: (r[4], r[0], r[2])):
                print('x %6.2f..%6.2f  y %5.2f..%5.2f  z %5.2f..%5.2f'
                      % tuple(round(v, 2) for v in r))


# A. 第二跑踏步朝上面
up_faces(-5.7, -0.2, 3.0, 5.05, 3.05, 6.45, 'A. 第二跑区域朝上面')

# B. 阁楼楼板（全屋）
up_faces(-7.0, 4.0, -1.0, 5.3, 6.05, 6.35, 'B. 阁楼楼板 z~6.17 朝上面')

# C. 净空：坡线 tread_z(x) = 3.19 + (x + 5.4) * 0.632
print('\n== C. 第二跑坡线上方净空（向上射线）==')
for y in (3.4, 3.7, 4.0, 4.3, 4.6):
    line = []
    for i in range(11):
        x = -5.3 + i * 0.46
        tread = 3.19 + (x + 5.4) * (6.18 - 3.19) / (-0.67 + 5.4)
        ok, loc, *_ = sc.ray_cast(dg, Vector((x, y, tread + 0.05)), Vector((0, 0, 1)))
        clr = (loc.z - tread) if ok else 99.0
        line.append(f'x={x:.2f}:{clr:.2f}')
    print(f'y={y}: ' + '  '.join(line))

# D. 顶部平台区域所有朝向面
print('\n== D. 顶部平台/井口所有面 (x -1.6..0.5, y 2.8..5.1, z 5.6..7.2) ==')
for o in bpy.data.objects:
    if o.type != 'MESH' or o.name.split('_')[0] in ('WALK', 'DOOR'):
        continue
    mw = o.matrix_world
    rot = mw.to_3x3()
    rows = []
    for p in o.data.polygons:
        c = mw @ p.center
        if not (-1.6 < c.x < 0.5 and 2.8 < c.y < 5.1 and 5.6 < c.z < 7.2):
            continue
        n = (rot @ p.normal).normalized()
        vs = [mw @ o.data.vertices[vi].co for vi in p.vertices]
        xs = sorted(v.x for v in vs)
        ys = sorted(v.y for v in vs)
        zs = sorted(v.z for v in vs)
        rows.append((tuple(round(v, 2) for v in n),
                     round(xs[0], 2), round(xs[-1], 2),
                     round(ys[0], 2), round(ys[-1], 2),
                     round(zs[0], 2), round(zs[-1], 2)))
    if rows:
        print(f'-- {o.name} ({len(rows)}) --')
        for r in sorted(rows, key=lambda r: (r[5], r[1], r[3])):
            print('n=%s  x %.2f..%.2f  y %.2f..%.2f  z %.2f..%.2f' % r)

# E. 平台向南射线（站立高 z=7.0 即地上 0.8m；和胸口 7.6）
print('\n== E. 平台(x=-0.7)向南射线 ==')
for z in (6.4, 7.0, 7.6):
    for x in (-1.1, -0.7, -0.3, 0.1):
        ok, loc, *_ = sc.ray_cast(dg, Vector((x, 4.6, z)), Vector((0, -1, 0)))
        print(f'x={x} z={z}: y_hit={"%.2f" % loc.y if ok else "---"}')
