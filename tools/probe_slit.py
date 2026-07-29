"""精确定位缝隙：
1. 南立面实际墙深（几个已知点的首击 y）
2. 西翼门西侧缝隙 (x≈-7.55) 的精细射线网格（z × x）
3. 中央凹槽两翼交界处 (x≈±3.4) 上层精细网格

用法: "$BLEND" -b models_src/house-split.blend --python tools/probe_slit.py
"""
import bpy
from mathutils import Vector

depsgraph = bpy.context.evaluated_depsgraph_get()
scene = bpy.context.scene


def hit_y(x, z, y0=-15.0, d=(0, 1, 0)):
    ok, loc, *_ = scene.ray_cast(depsgraph, Vector((x, y0, z)), Vector(d))
    return round(loc.y, 3) if ok else None


print('=== 1. 南立面墙深采样 ===')
for x, z in [(-6.5, 1.2), (-4.5, 1.2), (-2.0, 1.2), (0.0, 3.6), (-2.0, 4.2),
             (2.0, 4.2), (0.0, 4.8), (-6.5, 4.2), (6.5, 4.2)]:
    print(f'  x={x:6.2f} z={z:3.1f} -> 首击 y={hit_y(x, z)}')

print()
print('=== 2. 西门西侧缝隙网格（首击 y；None=完全穿透）===')
print('      z \\ x: ' + ' '.join(f'{-7.80 + i * 0.05:6.2f}' for i in range(14)))
z = 0.50
while z <= 2.55:
    row = []
    for i in range(14):
        x = -7.80 + i * 0.05
        y = hit_y(x, z)
        row.append(f'{y:6.2f}' if y is not None else '  None')
    print(f'  z={z:4.2f}: ' + ' '.join(row))
    z += 0.20

print()
print('=== 3. 凹槽西内角 (x -3.7..-2.9) 上层网格 ===')
print('      z \\ x: ' + ' '.join(f'{-3.70 + i * 0.05:6.2f}' for i in range(17)))
z = 2.60
while z <= 6.20:
    row = []
    for i in range(17):
        x = -3.70 + i * 0.05
        y = hit_y(x, z)
        row.append(f'{y:6.2f}' if y is not None else '  None')
    print(f'  z={z:4.2f}: ' + ' '.join(row))
    z += 0.20
