
import bpy
o = bpy.data.objects.get("WALL_01")
mw = o.matrix_world
from collections import Counter
cells = Counter()
for p in o.data.polygons:
    c = mw @ p.center
    if -1.6 < c.x < -0.4 and 3.0 < c.y < 5.0 and 2.3 < c.z < 4.0:
        cells[(round(c.x,1), round(c.y,1), round(c.z,1))] += 1
print("WALL_01 faces in shaft band:", sum(cells.values()))
for cell, n in sorted(cells.items())[:40]:
    print("  ", cell, n)
