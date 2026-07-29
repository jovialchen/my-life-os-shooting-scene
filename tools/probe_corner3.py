
import bpy
from mathutils import Vector
dg = bpy.context.evaluated_depsgraph_get()
sc = bpy.context.scene
for x in (4.0, 4.5, 5.0, 5.5, 6.0, 7.0):
    for y in (-4.6, -4.3, -4.0):
        ok, loc, *_ = sc.ray_cast(dg, Vector((x, y, 5.0)), Vector((0, 0, -1)))
        print(f'x={x} y={y}: z_hit={"%.2f" % loc.z if ok else "---"}')
