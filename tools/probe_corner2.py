
import bpy
from mathutils import Vector
dg = bpy.context.evaluated_depsgraph_get()
sc = bpy.context.scene
# 翼内 y 向墙：从 (5.5, 2.0, z) 往 -y 打
for z in (3.5, 4.0, 4.5):
    ok, loc, *_ = sc.ray_cast(dg, Vector((5.5, 2.0, z)), Vector((0, -1, 0)))
    print(f'wing ywall z={z}: y_hit={"%.2f" % loc.y if ok else "---"}')
# x 向墙：从 (3.0, y, 4.0) 往 +x 打
for y in (-4.6, -4.4, -4.2, -4.0, -3.8, -3.6, -3.4):
    ok, loc, *_ = sc.ray_cast(dg, Vector((3.0, y, 4.0)), Vector((1, 0, 0)))
    print(f'wing xwall y={y}: x_hit={"%.2f" % loc.x if ok else "---"}')
