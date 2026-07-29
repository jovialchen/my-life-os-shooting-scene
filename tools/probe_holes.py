"""精细测量已发现的洞口范围 + 检查其他立面顶部带是否有同类洞。

用法: "$BLEND" -b models_src/house-split.blend --python tools/probe_holes.py
"""
import bpy
from mathutils import Vector

depsgraph = bpy.context.evaluated_depsgraph_get()
scene = bpy.context.scene


def hole_map(name, origin_fn, direction, u0, u1, z0, z1, depth_fn,
             max_depth, u_step=0.025, z_step=0.05):
    """打印细网格洞图，并汇总每个 u 列有洞的 z 范围。"""
    print(f'\n=== {name} ===')
    cols = {}
    z = z1
    rows = []
    while z >= z0:
        row = ''
        u = u0
        while u <= u1 + 1e-9:
            o = origin_fn(u, z)
            ok, loc, *_ = scene.ray_cast(depsgraph, Vector(o),
                                         Vector(direction))
            depth = depth_fn(o, loc) if ok else 99.0
            hole = depth > max_depth
            row += 'X' if hole else '.'
            if hole:
                cols.setdefault(round(u, 3), []).append(round(z, 2))
            u += u_step
        rows.append((round(z, 2), row))
        z -= z_step
    hdr = '        ' + ''.join(
        str(abs(int(round((u0 + i * u_step) * 10))) % 10)
        for i in range(len(rows[0][1])))
    print(hdr)
    for zz, row in rows:
        print(f'  z={zz:5.2f} {row}')
    # 汇总连续洞段
    segs = []
    cur = None
    for u in sorted(cols):
        zs = cols[u]
        if cur and abs(u - cur[1]) < u_step * 1.5:
            cur = (cur[0], u, min(cur[2], min(zs)), max(cur[3], max(zs)))
        else:
            if cur:
                segs.append(cur)
            cur = (u, u, min(zs), max(zs))
    if cur:
        segs.append(cur)
    print('  洞段(u范围, z范围):')
    for a, b, zlo, zhi in segs:
        print(f'    u {a:7.3f}..{b:7.3f}  z {zlo:5.2f}..{zhi:5.2f}')


# 1. 中央上层墙顶部带 (y=-1.0, z 5.3..6.1, x -3.4..3.4)
hole_map('中央上层墙顶部带', lambda u, z: (u, -6, z), (0, 1, 0),
         -3.4, 3.4, 5.3, 6.1, lambda o, l: l[1] - o[1], 5.5)

# 2. 北面顶部带 (北墙 y≈4.9, 从 y=10 向 -y, x -9.5..9.5, z 5.3..6.1)
hole_map('北面上层顶部带', lambda u, z: (u, 10, z), (0, -1, 0),
         -9.5, 9.5, 5.3, 6.1, lambda o, l: o[1] - l[1], 5.5)

# 3. 西门面 slit 精细 (y=-3.97 立面, x -7.8..-7.2, z 0..2.6)
hole_map('西门旁 slit', lambda u, z: (u, -10, z), (0, 1, 0),
         -7.8, -7.2, 0.0, 2.6, lambda o, l: l[1] - o[1], 6.5)
