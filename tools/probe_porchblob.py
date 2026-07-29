
import bpy
from mathutils import Vector
dg = bpy.context.evaluated_depsgraph_get()
sc = bpy.context.scene
for x in (5.5, 6.0, 6.5, 7.0, 7.5):
    for y in (-5.4, -5.2, -5.0):
        ok, loc, *_ = sc.ray_cast(dg, Vector((x, y, 1.5)), Vector((0, 0, -1)))
        print(f"x={x} y={y}: down_hit={"%.2f" % loc.z if ok else "---"}")
