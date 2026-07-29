
import bpy
o = bpy.data.objects.get("WALL_01")
mw = o.matrix_world
n = 0
for p in o.data.polygons:
    vs = [mw @ v.co for v in p.vertices]
    xs=[v.x for v in vs]; ys=[v.y for v in vs]; zs=[v.z for v in vs]
    # 与井口梁区相交的面
    if max(xs)<-1.3 or min(xs)>-0.5: continue
    if max(ys)<3.0 or min(ys)>3.5: continue
    if max(zs)<2.5 or min(zs)>3.2: continue
    n += 1
    if n <= 15:
        cx,cy,cz=sum(xs)/len(xs),sum(ys)/len(ys),sum(zs)/len(zs)
        print(f"face c=({cx:.2f},{cy:.2f},{cz:.2f}) span=({max(xs)-min(xs):.2f},{max(ys)-min(ys):.2f},{max(zs)-min(zs):.2f}) nv={len(vs)}")
print("total", n)
