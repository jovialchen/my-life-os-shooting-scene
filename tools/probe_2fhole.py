"""查 2F 楼板东侧开口区域的几何朝上面（当前 house-split.blend）。

  blender -b models_src/house-split.blend --python tools/probe_2fhole.py
"""
import bpy

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
        cz = sum(v.z for v in vs) / len(vs)
        cx, cy = (xs[0] + xs[-1]) / 2, (ys[0] + ys[-1]) / 2
        if not (-1.6 < cx < 0.6 and 2.8 < cy < 5.2 and 3.0 < cz < 3.4):
            continue
        rows.append((round(xs[0], 2), round(xs[-1], 2),
                     round(ys[0], 2), round(ys[-1], 2), round(cz, 3)))
    if rows:
        print(f'== {o.name} ({len(rows)}) ==')
        for r in sorted(rows, key=lambda r: (r[2], r[0])):
            print('x %6.2f..%6.2f  y %5.2f..%5.2f  z %.3f' % r)
