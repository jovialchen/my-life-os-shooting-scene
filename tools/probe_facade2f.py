
import bpy
from mathutils import Vector
dg = bpy.context.evaluated_depsgraph_get()
sc = bpy.context.scene
# 2F 翼立面 y≈-4.0 开口：从 (x,-4.6,z) 往 +y 打，y_hit>-3.5 为进房间
print("行=z(Blender), 列=x 3.8..9.0 (#=墙 .=通)")
z = 5.5
while z >= 3.3:
    row = ""
    x = 3.8
    while x <= 9.0:
        ok, loc, *_ = sc.ray_cast(dg, Vector((x, -4.6, z)), Vector((0, 1, 0)))
        hit = ok and loc.y < -3.5
        row += "#" if hit else "."
        x += 0.2
    print(f"{z:5.2f} {row}")
    z -= 0.2
