
import bpy
from mathutils import Vector
for o in bpy.data.objects:
    if o.type != "MESH": continue
    bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
    xs=[v.x for v in bb]; ys=[v.y for v in bb]; zs=[v.z for v in bb]
    print(o.name, "x", round(min(xs),2), round(max(xs),2), "y", round(min(ys),2), round(max(ys),2), "z", round(min(zs),2), round(max(zs),2))
