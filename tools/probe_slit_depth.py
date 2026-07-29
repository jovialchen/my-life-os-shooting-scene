"""探测缝隙处的纵深形态：从墙外打射线打印前几个命中点
用法: blender -b models_src/house-split.blend --python tools/probe_slit_depth.py
"""
import bpy
from mathutils import Vector

dg = bpy.context.evaluated_depsgraph_get()
sc = bpy.context.scene

for u in (3.54, -3.54, 7.59):
    for z in (0.5, 1.5, 2.5, 4.0, 5.0, 6.0):
        o = Vector((u, -15.0, z))
        d = Vector((0, 1, 0))
        hits = []
        for _ in range(4):
            ok, loc, *_ = sc.ray_cast(dg, o, d)
            if not ok:
                break
            hits.append(round(loc.y, 2))
            o = loc + d * 0.02
        print(f'u={u:6.2f} z={z:4.1f} -> {hits}')
