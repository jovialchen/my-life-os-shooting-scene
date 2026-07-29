
import bpy
from mathutils import Vector
dg = bpy.context.evaluated_depsgraph_get()
sc = bpy.context.scene
# 从 (x, 2.5, z) 往 +y：找 y 3.2..4.9 之间的墙（打印前 3 个命中）
for x in (-1.4, -1.0, -0.6):
    for z in (2.2, 2.6, 3.0, 3.4):
        o = Vector((x, 2.5, z)); d = Vector((0, 1, 0)); hits = []
        for _ in range(3):
            ok, loc, *_ = sc.ray_cast(dg, o, d)
            if not ok: break
            hits.append(round(loc.y, 2))
            o = loc + d * 0.02
        print(f"x={x} z={z}: {hits}")
