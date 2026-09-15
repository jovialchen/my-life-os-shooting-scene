"""changjing.blend 结构探查：按空间邻近度聚类物体 + 大平面按材质分区统计。

用法: tools/blender.sh -b changjing.blend -P tools/probe_changjing.py
"""
import bpy
from mathutils import Vector


def bbox_world(ob):
    pts = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
    mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return mn, mx


# ── 大平面按材质分区（找卫生间/厨房的地面位置）──
print('=== PLANE MATERIAL ZONES ===')
for ob in bpy.data.objects:
    if ob.type != 'MESH' or not ob.data.materials:
        continue
    if len(ob.data.polygons) < 200:
        continue
    bymat = {}
    for poly in ob.data.polygons:
        slot = ob.material_slots[poly.material_index]
        name = slot.material.name if slot.material else '<none>'
        c = ob.matrix_world @ poly.center
        d = bymat.setdefault(name, [1e9, 1e9, 1e9, -1e9, -1e9, -1e9, 0])
        d[0] = min(d[0], c.x); d[1] = min(d[1], c.y); d[2] = min(d[2], c.z)
        d[3] = max(d[3], c.x); d[4] = max(d[4], c.y); d[5] = max(d[5], c.z)
        d[6] += 1
    print(f'  {ob.name} ({len(ob.data.polygons)} faces):')
    for name, d in sorted(bymat.items(), key=lambda kv: -kv[1][6]):
        print(f'    {name:16s} n={d[6]:5d} x[{d[0]:.2f},{d[3]:.2f}] '
              f'y[{d[1]:.2f},{d[4]:.2f}] z[{d[2]:.2f},{d[5]:.2f}]')

# ── 空间聚类（AABB 间距 < 阈值 → 同簇）──
objs = [o for o in bpy.data.objects if o.type == 'MESH']
boxes = {o.name: bbox_world(o) for o in objs}
THRESH = 0.30


def gap(a, b):
    (amn, amx), (bmn, bmx) = boxes[a], boxes[b]
    d = 0.0
    for i in range(3):
        g = max(amn[i] - bmx[i], bmn[i] - amx[i], 0.0)
        d += g * g
    return d ** 0.5


parent = {o.name: o.name for o in objs}


def find(x):
    while parent[x] != x:
        parent[x] = parent[parent[x]]
        x = parent[x]
    return x


def union(a, b):
    ra, rb = find(a), find(b)
    if ra != rb:
        parent[rb] = ra


names = [o.name for o in objs]
for i, a in enumerate(names):
    for b in names[i + 1:]:
        if gap(a, b) < THRESH:
            union(a, b)

clusters = {}
for n in names:
    clusters.setdefault(find(n), []).append(n)

print(f'\n=== CLUSTERS (threshold={THRESH}) ===')
rows = []
for root, members in clusters.items():
    mn = Vector((1e9, 1e9, 1e9))
    mx = Vector((-1e9, -1e9, -1e9))
    mats = {}
    faces = 0
    for n in members:
        a, b = boxes[n]
        for i in range(3):
            mn[i] = min(mn[i], a[i]); mx[i] = max(mx[i], b[i])
        ob = bpy.data.objects[n]
        faces += len(ob.data.polygons)
        for m in ob.data.materials:
            if m:
                mats[m.name] = mats.get(m.name, 0) + 1
    rows.append((len(members), mn, mx, members, mats, faces))
rows.sort(key=lambda r: (-r[0], r[1].x))
for i, (n, mn, mx, members, mats, faces) in enumerate(rows):
    size = mx - mn
    print(f'C{i:02d} n={n:3d} faces={faces:6d} '
          f'min=({mn.x:7.2f},{mn.y:7.2f},{mn.z:6.2f}) max=({mx.x:7.2f},{mx.y:7.2f},{mx.z:6.2f}) '
          f'size=({size.x:.2f},{size.y:.2f},{size.z:.2f})')
    print(f'     mats={sorted(mats)}')
    print(f'     objs={sorted(members)}')
