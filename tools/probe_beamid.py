
import bpy
from mathutils import Vector
dg = bpy.context.evaluated_depsgraph_get()
sc = bpy.context.scene
for x in (-1.2, -1.0, -0.7):
    ok, loc, nrm, idx, obj, mat = sc.ray_cast(dg, Vector((x, 3.2, 2.0)), Vector((0, 0, 1)))
    if ok:
        # 跳过我的楼梯对象，打第二个
        o = loc + Vector((0,0,0.02))
        ok2, loc2, n2, i2, obj2, m2 = sc.ray_cast(dg, o, Vector((0, 0, 1)))
        print(x, "1st:", obj.name if obj else None, round(loc.z,2), " 2nd:", (obj2.name if obj2 else None), (round(loc2.z,2) if ok2 else "---"))
