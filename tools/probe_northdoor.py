
import bpy
from mathutils import Vector
dg = bpy.context.evaluated_depsgraph_get()
sc = bpy.context.scene
for z in (0.3, 0.6, 0.9, 1.2, 1.5, 1.8):
    row = ""
    x = -3.0
    while x <= 3.0:
        ok, loc, *_ = sc.ray_cast(dg, Vector((x, 7.0, z)), Vector((0, -1, 0)))
        hit = ok and loc.y > 4.5
        row += "#" if hit else "."
        x += 0.05
    print(f"{z:5.2f} {row}")
