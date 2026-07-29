
import bpy
from mathutils import Vector
dg = bpy.context.evaluated_depsgraph_get()
sc = bpy.context.scene
# 东翼西墙 x≈3.6 的 2F 开口：从 (3.0,y,z) 往 +x 打射线
print("行=z(Blender), 列=y -4.8..0.2 (#=墙 .=通到东翼)")
z = 5.6
while z >= 3.3:
    row = ""
    y = -4.8
    while y <= 0.2:
        ok, loc, *_ = sc.ray_cast(dg, Vector((3.0, y, z)), Vector((1, 0, 0)))
        hit = ok and loc.x < 4.2
        row += "#" if hit else "."
        y += 0.2
    print(f"{z:5.2f} {row}")
    z -= 0.2
