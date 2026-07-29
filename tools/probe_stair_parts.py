"""列出中厅区域的连通块（找楼梯段）
用法: blender -b models_src/house-split.blend --python tools/probe_stair_parts.py
"""
import bpy
import bmesh
from mathutils import Vector

for o in bpy.data.objects:
    if o.type != 'MESH':
        continue
    mw = o.matrix_world
    bm = bmesh.new()
    bm.from_mesh(o.data)
    # 世界坐标顶点
    for v in bm.verts:
        v.co = mw @ v.co
    seen = set()
    parts = []
    for f in bm.faces:
        if f.index in seen:
            continue
        stack = [f]
        comp = []
        while stack:
            ff = stack.pop()
            if ff.index in seen:
                continue
            seen.add(ff.index)
            comp.append(ff)
            for e in ff.edges:
                for lf in e.link_faces:
                    if lf.index not in seen:
                        stack.append(lf)
        parts.append(comp)
    for comp in parts:
        vs = [v.co for f in comp for v in f.verts]
        xs = [c.x for c in vs]
        ys = [c.y for c in vs]
        zs = [c.z for c in vs]
        cx, cy, cz = sum(xs)/len(xs), sum(ys)/len(ys), sum(zs)/len(zs)
        # 中厅区域且有一定高度的块
        if -3.5 < cx < 3.5 and -3 < cy < 5 and 0.2 < cz < 6.3:
            print(f'{o.name:14s} n={len(comp):4d} c=({cx:6.2f},{cy:6.2f},{cz:5.2f}) '
                  f'span=({max(xs)-min(xs):5.2f},{max(ys)-min(ys):5.2f},{max(zs)-min(zs):5.2f})')
    bm.free()
