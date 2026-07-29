
import bpy
from mathutils import Vector
dg = bpy.context.evaluated_depsgraph_get()
sc = bpy.context.scene
for x in (-1.2, -1.0, -0.7):
    for y in (3.2, 3.35, 3.5):
        ups = []
        o = Vector((x, y, 0.2))
        for _ in range(6):
            ok, loc, *_ = sc.ray_cast(dg, o, Vector((0, 0, 1)))
            if not ok: break
            ups.append(round(loc.z, 2))
            o = loc + Vector((0, 0, 0.02))
        print(f"x={x} y={y} up: {ups}")
