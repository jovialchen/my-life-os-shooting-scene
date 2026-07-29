
import bpy
from mathutils import Vector
dg = bpy.context.evaluated_depsgraph_get()
sc = bpy.context.scene
for z in (0.2, 0.4, 0.6, 0.9, 1.2, 1.5):
    row = ""
    x = 5.0
    while x <= 8.0:
        ok, loc, *_ = sc.ray_cast(dg, Vector((x, -5.8, z)), Vector((0, 1, 0)))
        hit = ok and loc.y < -4.6
        row += "#" if hit else "."
        x += 0.1
    print(f"{z:5.2f} {row}")
