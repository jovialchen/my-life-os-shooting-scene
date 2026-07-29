
import bpy
from mathutils import Vector
dg = bpy.context.evaluated_depsgraph_get()
sc = bpy.context.scene
ok, loc, nrm, idx, obj, mat = sc.ray_cast(dg, Vector((-1.0, 3.2, 2.0)), Vector((0, 0, 1)))
print("hit", obj.name, "poly", idx, "z", round(loc.z,2))
mw = obj.matrix_world
p = obj.data.polygons[idx]
for vi in p.vertices:
    v = mw @ obj.data.vertices[vi].co
    print("  v", [round(c,2) for c in v])
