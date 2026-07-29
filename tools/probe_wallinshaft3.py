
import bpy
o = bpy.data.objects.get("WALL_01")
mw = o.matrix_world
n = 0
for p in o.data.polygons:
    vs = [mw @ v.co for v in p.vertices]
    xs=[v.x for v in vs]; ys=[v.y for v in vs]; zs=[v.z for v in vs]
    if max(xs)<-1.6 or min(xs)>-0.3: continue
    if max(ys)<2.9 or min(ys)>3.8: continue
    if max(zs)<1.5 or min(zs)>3.15: continue
    n += 1
    if n <= 25:
        cx,cy,cz=sum(xs)/len(xs),sum(ys)/len(ys),sum(zs)/len(zs)
        print(f"c=({cx:.2f},{cy:.2f},{cz:.2f}) span=({max(xs)-min(xs):.2f},{max(ys)-min(ys):.2f},{max(zs)-min(zs):.2f})")
print("total", n)
