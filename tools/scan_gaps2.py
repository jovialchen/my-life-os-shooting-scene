"""按"首击深度"扫描立面：找出立面上首击比预期墙面更深的段（墙上有洞，
即使洞内还有内墙）。用于定位任务6/7的"看得见屋内"的缝。

用法: "$BLEND" -b models_src/house-split.blend --python tools/scan_gaps2.py
"""
import bpy
from mathutils import Vector

depsgraph = bpy.context.evaluated_depsgraph_get()
scene = bpy.context.scene


def scan(name, origin_fn, direction, axis_v, lo, hi, max_depth, step=0.05):
    """沿扫描轴逐点打射线，首击沿射线方向的距离 > max_depth 的连续段视为洞。"""
    segs = []
    start = None
    n = int((hi - lo) / step) + 1
    for i in range(n):
        v = lo + i * step
        ok, loc, *_ = scene.ray_cast(depsgraph, Vector(origin_fn(v)),
                                     Vector(direction))
        depth = abs((loc[axis_v] - origin_fn(v)[axis_v])) if ok else 99.0
        hole = depth > max_depth
        if hole and start is None:
            start = v
        elif not hole and start is not None:
            if v - start >= 0.08:
                segs.append((round(start, 2), round(v, 2)))
            start = None
    if start is not None and hi - start >= 0.08:
        segs.append((round(start, 2), round(hi, 2)))
    # 过滤掉房屋范围外的段（首击距离 >20 表示射线根本没碰到房子）
    print(f'{name}: 洞段 {segs}')


# 南立面：墙在 y=-4.05(中央)/-5.2(翼)。首击深度从 y=-15 起算，
# 打到中央墙深度≈10.95，打到翼墙≈9.8。阈值 11.2 -> 只报穿透中央墙的洞
# （翼前空间 x±3.4 以外深度 ~9.8 不会误报，因为 11.2-10.95 余量小）。
for z in [0.6, 1.2, 1.8, 2.4, 3.6, 4.2, 4.8, 5.4, 6.0]:
    scan(f'南 z={z}', lambda x: (x, -15, z), (0, 1, 0), 1, -3.39, 3.39, 11.3)
print()
# 北立面：墙在 y≈+4.9~5.0，从 y=15 起算深度≈10.1
for z in [0.6, 1.2, 1.8, 2.4, 3.6, 4.2, 4.8, 5.4, 6.0]:
    scan(f'北 z={z}', lambda x: (x, 15, z), (0, -1, 0), 1, -9.5, 9.5, 10.3)
print()
# 翼侧墙（西面，x≈-9.5）：从 x=-15 起算深度≈5.5
for z in [1.2, 2.4, 3.6, 4.2, 4.8, 5.4]:
    scan(f'西 z={z}', lambda y: (-15, y, z), (1, 0, 0), 0, -3.9, 5.0, 5.8)
    scan(f'东 z={z}', lambda y: (15, y, z), (-1, 0, 0), 0, -3.9, 5.0, 5.8)
