
import bpy
from mathutils import Vector
dg = bpy.context.evaluated_depsgraph_get()
sc = bpy.context.scene
for x in (-1.4, -1.0, -0.6):
    for z in (1.4, 1.7, 2.0, 2.4, 2.8, 3.1, 3.4, 3.8):
        ok, loc, *_ = sc.ray_cast(dg, Vector((x, 2.0, z)), Vector((0, 1, 0)))
        print(f"x={x} z={z}: y_hit={"%.2f" % loc.y if ok else "---"}")
