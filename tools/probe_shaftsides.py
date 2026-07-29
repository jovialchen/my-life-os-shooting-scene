
import bpy
from mathutils import Vector
dg = bpy.context.evaluated_depsgraph_get()
sc = bpy.context.scene
for y in (3.4, 3.8, 4.2, 4.6):
    for z in (1.0, 2.0, 3.0, 4.0):
        okw, lw, *_ = sc.ray_cast(dg, Vector((-1.0, y, z)), Vector((-1, 0, 0)))
        oke, le, *_ = sc.ray_cast(dg, Vector((-1.0, y, z)), Vector((1, 0, 0)))
        print(f"y={y} z={z}: west={"%.2f" % lw.x if okw else "---"} east={"%.2f" % le.x if oke else "---"}")
