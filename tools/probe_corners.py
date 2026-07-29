"""凹槽两内角(x≈±3.4)竖向细扫：找角部竖缝。

用法: "$BLEND" -b models_src/house-split.blend --python tools/probe_corners.py
"""
import bpy
from mathutils import Vector

depsgraph = bpy.context.evaluated_depsgraph_get()
scene = bpy.context.scene

for xc, name in [(3.30, '东内角'), (-3.45, '西内角')]:
    print(f'\n=== {name} x {xc:.2f}..{xc + 0.20:.2f} (X=深于y=-0.8) ===')
    print('        ' + ''.join(str(i % 10) for i in range(11)))
    z = 6.2
    while z >= 0.0:
        row = ''
        for i in range(11):
            x = xc + i * 0.02
            ok, loc, *_ = scene.ray_cast(depsgraph, Vector((x, -8, z)),
                                         Vector((0, 1, 0)))
            deep = (loc.y > -0.8) if ok else True
            row += 'X' if deep else '.'
        print(f'  z={z:4.1f} {row}')
        z -= 0.2
