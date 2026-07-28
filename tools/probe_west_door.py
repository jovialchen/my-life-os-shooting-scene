"""精确测量西翼南面门洞（x≈-6.5, y≈-4）的尺寸。

用法: tools/blender.sh -b models_src/house-split.blend --python tools/probe_west_door.py
"""
import bpy
from mathutils import Vector

depsgraph = bpy.context.evaluated_depsgraph_get()
scene = bpy.context.scene

def cast(origin, direction, n=8):
    hits = []
    o = Vector(origin)
    for _ in range(n):
        ok, loc, *_ = scene.ray_cast(depsgraph, o, Vector(direction))
        if not ok:
            break
        hits.append(loc.copy())
        o = loc + Vector(direction) * 0.02
    return hits

print('--- 水平扫描 z=1.2（找门洞左右边缘）---')
x = -7.6
while x <= -5.4:
    hits = cast((x, -15, 1.2), (0, 1, 0))
    ys = [round(h.y, 3) for h in hits]
    print(f'x={x:6.2f}: {ys}')
    x += 0.1

print('--- 垂直扫描 x=-6.55（找门洞上沿/过梁）---')
z = 0.0
while z <= 3.2:
    hits = cast((-6.55, -15, z), (0, 1, 0))
    ys = [round(h.y, 3) for h in hits]
    print(f'z={z:5.2f}: {ys}')
    z += 0.1

print('--- 门洞中心剖面 x=-6.55, y 从 -5 到 -3（墙体厚度/门槛）---')
z = 0.05
hits = cast((-6.55, -6, 0.05), (0, 1, 0))
print('z=0.05:', [round(h.y, 3) for h in hits])
hits = cast((-6.55, -6, 2.6), (0, 1, 0))
print('z=2.60:', [round(h.y, 3) for h in hits])
