"""探测 2F 楼板南缘：x=3.0 和 x=0 处向下打射线
用法: blender -b models_src/house-split.blend --python tools/probe_slab_edge.py
"""
import bpy
from mathutils import Vector

dg = bpy.context.evaluated_depsgraph_get()
sc = bpy.context.scene

for x in (3.0, 0.0, -3.0):
    hits_line = []
    y = -5.0
    while y <= 3.0:
        ok, loc, *_ = sc.ray_cast(dg, Vector((x, y, 4.0)), Vector((0, 0, -1)))
        hits_line.append(f'{y:.1f}:{"%.2f" % loc.z if ok else "---"}')
        y += 0.25
    print(f'x={x}:', ' '.join(hits_line))
