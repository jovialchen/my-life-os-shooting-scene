"""全屋立面竖缝检测：
对每个立面平面做细密射线网格（u 向 0.03m，z 向 0.05m），
"洞"= 首击深于墙面 0.35m 以上。把每列连续的洞段按 z 合并，
报告 z 跨度 >= 0.8m 且宽度 <= 0.35m 的竖缝（窗户开口宽>0.35 天然排除）。

用法: "$BLEND" -b models_src/house-split.blend --python tools/probe_slits_all.py
"""
import bpy
from mathutils import Vector

depsgraph = bpy.context.evaluated_depsgraph_get()
scene = bpy.context.scene

U_STEP, Z_STEP = 0.03, 0.05
MIN_ZSPAN, MAX_WIDTH = 0.8, 0.35


def scan_plane(name, origin_fn, direction, u0, u1, z0, z1, depth_fn,
               max_depth):
    cols = []  # 每 u 列: (u, [(zlo, zhi), ...] 连续洞段)
    u = u0
    while u <= u1 + 1e-9:
        runs = []
        run_start = None
        z = z0
        while z <= z1 + 1e-9:
            o = origin_fn(u, z)
            ok, loc, *_ = scene.ray_cast(depsgraph, Vector(o),
                                         Vector(direction))
            depth = depth_fn(o, loc) if ok else 99.0
            if depth > max_depth:
                if run_start is None:
                    run_start = z
            else:
                if run_start is not None:
                    runs.append((run_start, z))
                    run_start = None
            z += Z_STEP
        if run_start is not None:
            runs.append((run_start, z1))
        runs = [r for r in runs if r[1] - r[0] >= MIN_ZSPAN]
        if runs:
            cols.append((round(u, 3), runs))
        u += U_STEP
    # 相邻 u 列合并成缝（z 范围取交集近似）
    slits = []
    cur = None
    for u, runs in cols:
        zlo = min(r[0] for r in runs)
        zhi = max(r[1] for r in runs)
        if cur and u - cur[1] <= U_STEP * 1.5 \
                and abs(zlo - cur[2]) < 0.4 and abs(zhi - cur[3]) < 0.4:
            cur = (cur[0], u, min(cur[2], zlo), max(cur[3], zhi))
        else:
            if cur:
                slits.append(cur)
            cur = (u, u, zlo, zhi)
    if cur:
        slits.append(cur)
    print(f'\n=== {name} ===')
    for a, b, zlo, zhi in slits:
        w = b - a + U_STEP
        tag = ' 竖缝!' if w <= MAX_WIDTH else ' (宽口, 可能是窗)'
        print(f'  u {a:7.3f}..{b:7.3f} (宽{w:.2f})  z {zlo:5.2f}..{zhi:5.2f}{tag}')


# 南立面(含两翼+中央底层) y=-3.97: 从 y=-12 打 +y, 墙深≈8.03
scan_plane('南立面 y=-3.97', lambda u, z: (u, -12, z), (0, 1, 0),
           -9.6, 9.6, 0.0, 6.8, lambda o, l: l[1] - o[1], 8.4)
# 中央上层墙 y=-1.0: 从 y=-8 打, 墙深≈7.0
scan_plane('中央上层 y=-1.0', lambda u, z: (u, -8, z), (0, 1, 0),
           -3.4, 3.4, 3.1, 6.2, lambda o, l: l[1] - o[1], 7.35)
# 北立面 y≈4.93: 从 y=12 打 -y, 墙深≈7.07
scan_plane('北立面 y=4.93', lambda u, z: (u, 12, z), (0, -1, 0),
           -9.6, 9.6, 0.0, 6.2, lambda o, l: o[1] - l[1], 7.4)
# 西立面 x=-9.5 / 东立面 x=9.55
scan_plane('西立面 x=-9.5', lambda u, z: (-12, u, z), (1, 0, 0),
           -3.9, 5.0, 0.0, 6.2, lambda o, l: l[0] - o[0], 2.9)
scan_plane('东立面 x=9.55', lambda u, z: (12, u, z), (-1, 0, 0),
           -3.9, 5.0, 0.0, 6.2, lambda o, l: o[0] - l[0], 2.9)
# 翼内侧墙 x=±3.5 (凹槽侧)
scan_plane('西翼内侧 x=-3.5', lambda u, z: (-1.0, u, z), (-1, 0, 0),
           -3.9, -1.0, 0.0, 6.2, lambda o, l: o[0] - l[0], 2.9)
scan_plane('东翼内侧 x=+3.5', lambda u, z: (1.0, u, z), (1, 0, 0),
           -3.9, -1.0, 0.0, 6.2, lambda o, l: l[0] - o[0], 2.9)
