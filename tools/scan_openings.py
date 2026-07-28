"""射线扫描四个立面，找底层(z~1.2)的开口（门洞）。

用法: tools/blender.sh -b models_src/house-split.blend --python tools/scan_openings.py
"""
import bpy
from mathutils import Vector

depsgraph = bpy.context.evaluated_depsgraph_get()
scene = bpy.context.scene

def scan(name, origin_fn, direction, axis_index, lo, hi, step=0.25):
    """沿一条水平线打射线，报告每条射线击中的距离列表。"""
    print(f'\n=== {name} ===')
    n = int((hi - lo) / step) + 1
    for i in range(n):
        v = lo + i * step
        origin = origin_fn(v)
        hits = []
        o = Vector(origin)
        for _ in range(6):
            ok, loc, *_ = scene.ray_cast(depsgraph, o, Vector(direction))
            if not ok:
                break
            d = (loc - Vector(origin)).length
            hits.append(round(d, 2))
            o = loc + Vector(direction) * 0.05
        mark = ' <-- 穿透(可能有门洞)' if hits and hits[-1] > 8 or not hits else ''
        print(f'  {v:6.2f}: {hits}{mark}')

H = 1.2   # 扫描高度（门洞中间）
# 南立面: 从 y=-15 向 +y 扫，沿 x
scan('南立面 (y- → +y)', lambda x: (x, -15, H), (0, 1, 0), 0, -9.5, 9.5)
# 北立面: 从 y=15 向 -y 扫
scan('北立面 (y+ → -y)', lambda x: (x, 15, H), (0, -1, 0), 0, -9.5, 9.5)
# 西立面: 从 x=-15 向 +x 扫，沿 y
scan('西立面 (x- → +x)', lambda y: (-15, y, H), (1, 0, 0), 1, -9.5, 9.5)
# 东立面: 从 x=15 向 -x 扫
scan('东立面 (x+ → -x)', lambda y: (15, y, H), (-1, 0, 0), 1, -9.5, 9.5)
