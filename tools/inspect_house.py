"""探查 models_src/house.blend 的结构：物体、材质、松散块。

用法: tools/blender.sh -b models_src/house.blend --python tools/inspect_house.py
"""
import bpy
import bmesh


def part_stats(obj):
    """对单个 mesh 物体按松散块（linked faces）统计。"""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.faces.ensure_lookup_table()

    visited = set()
    parts = []
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
        parts.append(comp)

    print(f"\n=== 物体 {obj.name}: {len(bm.faces)} 面, {len(bm.verts)} 顶点, "
          f"{len(parts)} 个松散块 ===")
    # 按面数排序，打印每个块的包围盒和朝向统计
    parts.sort(key=len, reverse=True)
    for i, comp in enumerate(parts):
        xs, ys, zs = [], [], []
        up = 0
        for f in comp:
            for v in f.verts:
                xs.append(v.co.x)
                ys.append(v.co.y)
                zs.append(v.co.z)
            if f.normal.z > 0.5:
                up += 1
        n = len(comp)
        print(f"  part{i:03d}: faces={n:6d} "
              f"bbox=({min(xs):7.2f},{min(ys):7.2f},{min(zs):7.2f})~"
              f"({max(xs):7.2f},{max(ys):7.2f},{max(zs):7.2f}) "
              f"size=({max(xs)-min(xs):6.2f},{max(ys)-min(ys):6.2f},{max(zs)-min(zs):6.2f}) "
              f"up={up/n*100:4.0f}%")
        if i >= 40 and len(parts) > 50:
            print(f"  ... 其余 {len(parts)-41} 个小块省略")
            break
    bm.free()


print("=== 场景物体 ===")
for o in bpy.data.objects:
    print(f"{o.type:10s} {o.name}")
print("\n=== 材质 ===")
for m in bpy.data.materials:
    print(m.name)

for o in bpy.data.objects:
    if o.type == 'MESH':
        part_stats(o)
