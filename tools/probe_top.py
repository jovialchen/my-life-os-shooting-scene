
import bpy
from mathutils import Vector
dg = bpy.context.evaluated_depsgraph_get()
sc = bpy.context.scene
# 从 (x, -3, z) 往 +y 打射线，打印命中点（找楼梯顶/板缘附近的障碍）
for x in (2.6, 3.0, 3.4):
    for z in (3.5, 4.0, 4.5, 5.0):
        ok, loc, *_ = sc.ray_cast(dg, Vector((x, -3.0, z)), Vector((0, 1, 0)))
        print(f'x={x} z={z}: y_hit={"%.2f" % loc.y if ok else "---"}')
