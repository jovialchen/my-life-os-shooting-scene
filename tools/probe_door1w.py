
import bpy
from mathutils import Vector
dg = bpy.context.evaluated_depsgraph_get()
sc = bpy.context.scene
for z in (0.15, 0.3, 0.5, 0.7, 0.9):
    row = ""
    x = -4.0
    while x <= 0.0:
        ok, loc, *_ = sc.ray_cast(dg, Vector((x, -3.0, z)), Vector((0, 1, 0)))
        hit = ok and loc.y < -0.5
        row += "#" if hit else "."
        x += 0.05
    print(f"{z:5.2f} {row}")
