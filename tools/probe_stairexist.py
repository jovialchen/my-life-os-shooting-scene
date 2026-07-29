
import bpy
from collections import Counter
for o in bpy.data.objects:
    if o.type != "MESH": continue
    mw = o.matrix_world
    rot = mw.to_3x3()
    cells = Counter()
    for p in o.data.polygons:
        c = mw @ p.center
        if not (-5.5 < c.x < 0.0 and 2.8 < c.y < 3.6 and 0.0 < c.z < 3.4):
            continue
        n = (rot @ p.normal).normalized()
        kind = "UP" if n.z > 0.5 else ("DOWN" if n.z < -0.5 else "SIDE")
        cells[(o.name, kind)] += 1
    for k, v in cells.items():
        print(k, v)
