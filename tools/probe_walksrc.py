"""列出 WALK_floors 在 x -1.5..1.5, y 3.0..5.2, z 2.8..3.5 的面来源区域。

  blender -b models_src/house-split.blend --python tools/probe_walksrc.py
"""
import bpy

o = bpy.data.objects.get('WALK_floors')
mw = o.matrix_world
for p in o.data.polygons:
    vs = [mw @ o.data.vertices[vi].co for vi in p.vertices]
    xs = sorted(v.x for v in vs)
    ys = sorted(v.y for v in vs)
    zs = sorted(v.z for v in vs)
    cx, cy, cz = ((xs[0] + xs[-1]) / 2, (ys[0] + ys[-1]) / 2,
                  (zs[0] + zs[-1]) / 2)
    if not (-1.5 < cx < 1.5 and 3.0 < cy < 5.2 and 2.8 < cz < 3.5):
        continue
    print('x %6.2f..%6.2f  y %5.2f..%5.2f  z %.3f..%.3f'
          % (xs[0], xs[-1], ys[0], ys[-1], zs[0], zs[-1]))
