"""探测楼梯区域（x -6..0, y 2.5..5.5, z 0.1..6.5）所有朝上面，找转角平台/异步踏步。

  blender -b models_src/house-split.blend --python tools/probe_whitestairs.py
"""
import bpy

for o in bpy.data.objects:
    if o.type != 'MESH' or o.name.split('_')[0] in ('WALK', 'DOOR', 'WINDOW'):
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
        sx, sy = xs[-1] - xs[0], ys[-1] - ys[0]
        cz = sum(v.z for v in vs) / len(vs)
        cx, cy = (xs[0] + xs[-1]) / 2, (ys[0] + ys[-1]) / 2
        if not (-6.5 < cx < 0.5 and 2.5 < cy < 5.5 and 0.1 < cz < 6.5):
            continue
        rows.append((round(cx, 2), round(cy, 2), round(cz, 2),
                     round(sx, 2), round(sy, 2)))
    if rows:
        print(f'== {o.name} ({len(rows)}) ==')
        for r in sorted(rows, key=lambda r: (r[2], r[0], r[1])):
            print('cx=%6.2f cy=%5.2f cz=%5.2f sx=%4.2f sy=%4.2f' % r)
