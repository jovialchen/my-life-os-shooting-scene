
import bpy
from mathutils import Vector
o = bpy.data.objects.get("WALL_gapfill")
print("found:", o is not None)
if o:
    bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
    print("bbox x", round(min(v.x for v in bb),2), round(max(v.x for v in bb),2))
    print("bbox y", round(min(v.y for v in bb),2), round(max(v.y for v in bb),2))
    print("bbox z", round(min(v.z for v in bb),2), round(max(v.z for v in bb),2))
    # 每个连通块中心: 用顶点聚类太麻烦，打印前 20 个顶点坐标
    vs = [o.matrix_world @ v.co for v in o.data.vertices]
    for v in vs[:24]:
        print("v", round(v.x,2), round(v.y,2), round(v.z,2))
