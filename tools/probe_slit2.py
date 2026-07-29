"""洞图：南立面 4 个候选缝区域 + 外侧角，确认填充范围（窗 vs 缝）。

用法: "$BLEND" -b models_src/house-split.blend --python tools/probe_slit2.py
"""
import bpy
from mathutils import Vector

depsgraph = bpy.context.evaluated_depsgraph_get()
scene = bpy.context.scene


def hole_map(name, u0, u1, z0, z1, u_step=0.03, z_step=0.1):
    print(f'\n=== {name} (X=洞) u {u0}..{u1} ===')
    print('        ' + ''.join(
        str(abs(int(round((u0 + i * u_step) * 100) / 10)) % 10)
        for i in range(int((u1 - u0) / u_step) + 1)))
    z = z1
    while z >= z0:
        row = ''
        u = u0
        while u <= u1 + 1e-9:
            ok, loc, *_ = scene.ray_cast(
                depsgraph, Vector((u, -12, z)), Vector((0, 1, 0)))
            deep = (loc.y - (-12)) > 8.4 if ok else True
            row += 'X' if deep else '.'
            u += u_step
        print(f'  z={z:4.1f} {row}')
        z -= z_step


hole_map('西门缝 x-7.8..-7.3', -7.8, -7.3, 0.0, 6.8)
hole_map('东门缝 x 7.3..7.8', 7.3, 7.8, 0.0, 6.8)
hole_map('西角缝 x-3.8..-3.3', -3.8, -3.3, 0.0, 6.8)
hole_map('东角缝 x 3.3..3.8', 3.3, 3.8, 0.0, 6.8)
hole_map('西外角 x-9.7..-9.4', -9.7, -9.4, 0.0, 6.8)
