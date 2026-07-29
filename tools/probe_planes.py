"""对凹槽周围的 4 个墙面做精细垂直射线网格，打出"洞地图"。

洞 = 首击明显深于墙面 或 完全穿透。窗洞也会显示为洞（预期内），
用于找出非窗洞的缝隙。

用法: "$BLEND" -b models_src/house-split.blend --python tools/probe_planes.py
"""
import bpy
from mathutils import Vector

depsgraph = bpy.context.evaluated_depsgraph_get()
scene = bpy.context.scene


def grid(name, origin_fn, direction, u_range, z_range, depth_fn, max_depth,
         u_step=0.1, z_step=0.2):
    print(f'\n=== {name} (X=洞, .=实体, 数字行是 z) ===')
    hdr = '       ' + ''.join(str(int(round(u * 10)) % 10)
                               for u in frange(*u_range, u_step))
    print(hdr)
    z = z_range[1]
    while z >= z_range[0]:
        row = ''
        for u in frange(*u_range, u_step):
            o = origin_fn(u, z)
            ok, loc, *_ = scene.ray_cast(depsgraph, Vector(o),
                                         Vector(direction))
            depth = depth_fn(o, loc) if ok else 99.0
            row += 'X' if depth > max_depth else '.'
        print(f'  z={z:4.1f} {row}')
        z -= z_step


def frange(a, b, step):
    v = a
    while v <= b + 1e-9:
        yield round(v, 4)
        v += step


# A. 中央上层墙 y≈-1.0: 从 y=-6 向 +y 打，深度 = hit.y - (-6)，墙深≈5.0
grid('A 中央上层墙 y=-1.0 (u=x)', lambda u, z: (u, -6, z), (0, 1, 0),
     (-3.4, 3.4), (3.2, 6.2), lambda o, l: l[1] - o[1], 5.5)

# B. 中央底层墙 y≈-3.97: 从 y=-10 向 +y，墙深≈6.0
grid('B 中央底层墙 y=-3.97 (u=x)', lambda u, z: (u, -10, z), (0, 1, 0),
     (-3.4, 3.4), (0.0, 3.0), lambda o, l: l[1] - o[1], 6.5)

# C1. 西翼内侧墙 x≈-3.5: 从 x=-1.0 向 -x 打，墙深≈2.5
grid('C1 西翼内侧墙 x=-3.5 (u=y)', lambda u, z: (-1.0, u, z), (-1, 0, 0),
     (-3.9, -1.0), (0.0, 6.2), lambda o, l: o[0] - l[0], 3.0)

# C2. 东翼内侧墙 x≈+3.5: 从 x=1.0 向 +x 打
grid('C2 东翼内侧墙 x=+3.5 (u=y)', lambda u, z: (1.0, u, z), (1, 0, 0),
     (-3.9, -1.0), (0.0, 6.2), lambda o, l: l[0] - o[0], 3.0)
