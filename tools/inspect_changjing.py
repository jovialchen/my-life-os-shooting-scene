"""列出 changjing.blend 里的物体树（名称/类型/尺寸/世界坐标/材质/父级）。

用法: tools/blender.sh -b changjing.blend -P tools/inspect_changjing.py
"""
import bpy
import math
from mathutils import Vector

print('=== COLLECTIONS ===')
for c in bpy.data.collections:
    print('  COL', c.name, 'objs=', len(c.objects))


def bbox_world(ob):
    pts = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
    mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return mn, mx


print('=== OBJECTS ===')
for ob in sorted(bpy.data.objects, key=lambda o: o.name):
    mn, mx = bbox_world(ob)
    size = mx - mn
    parent = ob.parent.name if ob.parent else '-'
    mats = [m.name for m in ob.data.materials] if ob.type == 'MESH' and ob.data else []
    ntris = len(ob.data.polygons) if ob.type == 'MESH' and ob.data else 0
    print(f'{ob.name}\t{ob.type}\tparent={parent}\t'
          f'min=({mn.x:.3f},{mn.y:.3f},{mn.z:.3f})\tmax=({mx.x:.3f},{mx.y:.3f},{mx.z:.3f})\t'
          f'size=({size.x:.3f},{size.y:.3f},{size.z:.3f})\tloc=({ob.location.x:.3f},{ob.location.y:.3f},{ob.location.z:.3f})\t'
          f'faces={ntris}\tmats={mats}\tcollections={[c.name for c in ob.users_collection]}')

print('=== MATERIALS ===')
for m in bpy.data.materials:
    print('  MAT', m.name, 'nodes=', m.use_nodes,
          [n.type for n in m.node_tree.nodes] if m.use_nodes else '')
