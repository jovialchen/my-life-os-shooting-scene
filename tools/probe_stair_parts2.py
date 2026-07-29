
import bpy, bmesh
from mathutils import Vector
for o in bpy.data.objects:
    if o.type != "MESH": continue
    mw = o.matrix_world
    bm = bmesh.new(); bm.from_mesh(o.data)
    for v in bm.verts: v.co = mw @ v.co
    seen=set(); parts=[]
    for f in bm.faces:
        if f.index in seen: continue
        stack=[f]; comp=[]
        while stack:
            ff=stack.pop()
            if ff.index in seen: continue
            seen.add(ff.index); comp.append(ff)
            for e in ff.edges:
                for lf in e.link_faces:
                    if lf.index not in seen: stack.append(lf)
        parts.append(comp)
    for comp in parts:
        vs=[v.co for f in comp for v in f.verts]
        xs=[c.x for c in vs]; ys=[c.y for c in vs]; zs=[c.z for c in vs]
        sx,sy,sz=max(xs)-min(xs),max(ys)-min(ys),max(zs)-min(zs)
        cx,cy,cz=sum(xs)/len(xs),sum(ys)/len(ys),sum(zs)/len(zs)
        if 0.9<sz<3.3 and 0.3<max(sx,sy)<4.0 and min(sx,sy)>0.15 and cz<6.5:
            print(f"{o.name:12s} n={len(comp):4d} c=({cx:6.2f},{cy:6.2f},{cz:5.2f}) span=({sx:5.2f},{sy:5.2f},{sz:5.2f})")
    bm.free()
