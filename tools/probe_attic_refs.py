"""调试：确认阁楼参考点是否在开放空间（六向射线距离）
用法: blender -b models_src/house-split.blend --python tools/probe_attic_refs.py
"""
import bpy
from mathutils import Vector

REFS = [(0, 8, 2), (-4, 7.5, 2), (4, 7.5, 2),
        (0, 8, -2), (-4, 7.5, -2), (4, 7.5, -2)]
DIRS = [(1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1)]

dg = bpy.context.evaluated_depsgraph_get()
sc = bpy.context.scene
for r in REFS:
    c = Vector(r)
    out = []
    for d in DIRS:
        hit, loc, *_ = sc.ray_cast(dg, c, Vector(d))
        out.append(f'{(loc - c).length:.2f}' if hit else 'OPEN')
    print(r, out)
