"""找门洞：分析底层(z<3.2)外墙板沿各立面的分布，找水平缺口。

用法: tools/blender.sh -b models_src/house.blend --python tools/find_doorway.py
"""
import bpy
import bmesh
from mathutils import Vector

obj = next(o for o in bpy.data.objects if o.type == 'MESH')
mw = obj.matrix_world
bm = bmesh.new()
bm.from_mesh(obj.data)
bm.faces.ensure_lookup_table()

visited = set()
panels = []
for face in bm.faces:
    if face.index in visited:
        continue
    stack = [face]
    comp = []
    while stack:
        f = stack.pop()
        if f.index in visited:
            continue
        visited.add(f.index)
        comp.append(f)
        for v in f.verts:
            for lf in v.link_faces:
                if lf.index not in visited:
                    stack.append(lf)
    pts = [mw @ v.co for f in comp for v in f.verts]
    mins = Vector((min(p[i] for p in pts) for i in range(3)))
    maxs = Vector((max(p[i] for p in pts) for i in range(3)))
    size = maxs - mins
    # 底层竖直薄板（墙板/门框板）: z 从接近 0 开始，竖直，薄
    if mins.z < 0.3 and maxs.z > 2.0 and min(size.x, size.y, size.z) < 0.45:
        panels.append((mins, maxs, size, len(comp)))

print(f'底层竖直板 {len(panels)} 块:')
panels.sort(key=lambda p: (round(p[0].y, 1), p[0].x))
for mins, maxs, size, n in panels:
    orient = 'X向(沿x延伸)' if size.x > size.y else 'Y向(沿y延伸)'
    print(f"  {orient} x=({mins.x:6.2f},{maxs.x:6.2f}) "
          f"y=({mins.y:6.2f},{maxs.y:6.2f}) z=({mins.z:5.2f},{maxs.z:5.2f}) "
          f"faces={n}")
bm.free()
