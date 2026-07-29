"""多高度射线扫描四个立面，汇总所有贯穿开口（任务6/7 定位用）。

对每个 (立面, 高度) 沿水平线打射线；完全没有命中的连续段记为开口。
只报告宽度 >= 0.1m 的开口段。

用法: "$BLEND" -b models_src/house-split.blend --python tools/scan_gaps.py
"""
import bpy
from mathutils import Vector

depsgraph = bpy.context.evaluated_depsgraph_get()
scene = bpy.context.scene


def scan_line(origin_fn, direction, lo, hi, step=0.05):
    """返回开口段列表 [(a, b), ...]（沿扫描轴无命中的区间）。"""
    gaps = []
    open_start = None
    n = int((hi - lo) / step) + 1
    for i in range(n):
        v = lo + i * step
        ok, *_ = scene.ray_cast(depsgraph, Vector(origin_fn(v)),
                                Vector(direction))
        if not ok:
            if open_start is None:
                open_start = v
        else:
            if open_start is not None:
                if v - open_start >= 0.1:
                    gaps.append((round(open_start, 2), round(v, 2)))
                open_start = None
    if open_start is not None and hi - open_start >= 0.1:
        gaps.append((round(open_start, 2), round(hi, 2)))
    return gaps


HEIGHTS = [0.6, 1.2, 1.8, 2.4, 3.6, 4.2, 4.8, 5.4, 6.3, 6.6]
for z in HEIGHTS:
    for name, ofn, d in [
        ('南(y-→+)', lambda x: (x, -15, z), (0, 1, 0)),
        ('北(y+→-)', lambda x: (x, 15, z), (0, -1, 0)),
        ('西(x-→+)', lambda y: (-15, y, z), (1, 0, 0)),
        ('东(x+→-)', lambda y: (15, y, z), (-1, 0, 0)),
    ]:
        gaps = scan_line(ofn, d, -9.8, 9.8)
        if gaps:
            print(f'z={z:4.1f} {name}: {gaps}')
