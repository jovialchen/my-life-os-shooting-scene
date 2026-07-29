
import bpy
from mathutils import Vector
dg = bpy.context.evaluated_depsgraph_get()
sc = bpy.context.scene
for z in (3.25, 3.35, 3.45, 3.55, 3.65, 3.75):
    row = ""
    x = 4.0
    while x <= 5.6:
        ok, loc, *_ = sc.ray_cast(dg, Vector((x, -4.6, z)), Vector((0, 1, 0)))
        hit = ok and loc.y < -3.5
        row += "#" if hit else "."
        x += 0.05
    print(f"{z:5.2f} {row}")
