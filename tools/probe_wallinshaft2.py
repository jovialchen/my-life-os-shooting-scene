
import bpy
o = bpy.data.objects.get("WALL_01")
mw = o.matrix_world
from collections import Counter
cells = Counter()
for p in o.data.polygons:
    c = mw @ p.center
    if -2.2 < c.x < 0.2 and 2.9 < c.y < 3.8 and 1.4 < c.z < 3.2:
        cells[(round(c.x,1), round(c.y,1), round(c.z,1))] += 1
print("WALL faces near landing:", sum(cells.values()))
for cell, n in sorted(cells.items())[:30]:
    print("  ", cell, n)
