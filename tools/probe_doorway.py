
import bpy
from mathutils import Vector
dg = bpy.context.evaluated_depsgraph_get()
sc = bpy.context.scene
for z in (0.1, 0.3, 0.5, 0.8, 1.1, 1.5, 1.9):
    row = ""
    x = 5.8
    while x <= 7.2:
        ok, loc, *_ = sc.ray_cast(dg, Vector((x, -4.6, z)), Vector((0, 1, 0)))
        hit = ok and loc.y < -3.5
        row += "#" if hit else "."
        x += 0.05
    print(f"{z:5.2f} {row}")
