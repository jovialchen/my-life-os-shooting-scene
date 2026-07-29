
import bpy
from mathutils import Vector
dg = bpy.context.evaluated_depsgraph_get()
sc = bpy.context.scene
# y=-0.95 墙的开口图：从 (x,-3.0,z) 往 +y 打射线，y_hit<-0.5 表示有墙
print("行=z(Blender), 列=x -4..4 (#=墙 .=通)")
z = 3.6
while z >= 0.1:
    row = ""
    x = -4.0
    while x <= 4.0:
        ok, loc, *_ = sc.ray_cast(dg, Vector((x, -3.0, z)), Vector((0, 1, 0)))
        row += "#" if (ok and loc.y < -0.5) else "."
        x += 0.2
    print(f"{z:5.2f} {row}")
    z -= 0.2
