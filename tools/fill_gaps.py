"""修补外墙竖向缝隙（task 6/7）：在墙腔里塞墙色薄板挡住视线。

缝隙来自 tools/probe_slits_all.py 的实测（正面/北面扫描，光线穿墙
>0.35m 判定为缝）：
  - 正面中 bay 两侧 u≈±3.51..3.63（4.png 门边那道缝）
  - 正面翼墙板接缝 u≈±7.56..7.62
  - 正面/北面转角 u≈±9.54..9.60（5.png 檐下那道缝）
每条缝按 z 切成 0.5m 高的小段，每段在缝旁 ±0.15m 处从墙外打射线
实测该高度墙板所在深度，薄板贴着同深度埋进墙腔——既能挡住穿墙
视线，又不会从立面或屋内凸出来（一二楼立面有错位/挑檐）。
中 bay 大开口 u±3.48 是门窗/通道，不能填。

管线顺序（重新生成 models/house.glb）：
  blender -b models_src/house.blend       --python tools/split_house.py
  blender -b models_src/house-split.blend --python tools/fill_gaps.py
  blender -b models_src/house-split.blend --python tools/add_door.py
"""
import bpy
from mathutils import Vector

ROOT_BLEND = 'models_src/house-split.blend'

# (wall_side, u_min, u_max, z_min, z_max)
# wall_side: 'front' = 正面（射线从 y=-15 往 +y），'back' = 北面（y=+15 往 -y）
SLITS = []
for u0, u1, z0, z1 in [
    (-9.60, -9.57, 0.00, 6.80), (-9.54, -9.53, 0.15, 6.10),
    (-7.62, -7.59, 0.15, 6.10), (-7.57, -7.55, 0.15, 3.10),
    (-3.63, -3.62, 0.15, 6.10), (-3.57, -3.51, 0.15, 6.10),
    (3.51, 3.57, 0.15, 6.10), (3.62, 3.63, 0.15, 6.10),
    (7.56, 7.62, 0.15, 6.10),
    (9.53, 9.54, 0.15, 6.10), (9.57, 9.60, 0.00, 6.80),
]:
    SLITS.append(('front', u0, u1, z0, z1))
for u0, u1, z0, z1 in [
    (-9.60, -9.54, 0.00, 6.20), (9.54, 9.60, 0.00, 6.20),
]:
    SLITS.append(('back', u0, u1, z0, z1))

PAD_U, PAD_Z, DEPTH, BAND = 0.04, 0.03, 0.12, 0.5


def wall_depth(scene, depsgraph, side, u, z):
    """从墙外打射线找 (u,z) 处墙板深度（第一个命中点的 y），无命中返回 None"""
    if side == 'front':
        o, d = Vector((u, -15.0, z)), Vector((0, 1, 0))
    else:
        o, d = Vector((u, 15.0, z)), Vector((0, -1, 0))
    ok, loc, *_ = scene.ray_cast(depsgraph, o, d)
    return loc.y if ok else None


def main():
    scene = bpy.context.scene
    depsgraph = bpy.context.evaluated_depsgraph_get()
    wall_mat = bpy.data.materials.get('MAT_wall')
    fillers = []
    n_band = 0

    for side, u0, u1, z0, z1 in SLITS:
        # 1) 每个 z 小段在缝两侧探测墙板深度（探针可能落进中 bay 开口
        #    打到屋内远墙，取最靠外侧/立面的深度）
        bands = []   # (z_lo, z_hi, depth|None)
        z = z0
        while z < z1 - 1e-9:
            z_hi = min(z + BAND, z1)
            zc = (z + z_hi) / 2
            depths = [d for d in (
                wall_depth(scene, depsgraph, side, u0 - 0.15, zc),
                wall_depth(scene, depsgraph, side, u1 + 0.15, zc),
            ) if d is not None]
            bands.append((z, z_hi,
                          (min(depths) if side == 'front' else max(depths))
                          if depths else None))
            z = z_hi

        # 2) 每条缝一个统一深度：所有小段探测值的中位数
        #    （个别探针落进开口打到屋内远墙会被中位数自然丢弃；
        #    整板与立面墙板齐平，不逐段抖动出锯齿，也不凸出）
        depths = sorted(dep for _, _, dep in bands if dep is not None)
        if not depths:
            continue
        wy = depths[len(depths) // 2]

        # 3) 一块整板，从立面往墙腔内埋，外面略收进立面
        cy = wy + DEPTH / 2 - 0.01 if side == 'front' else wy - DEPTH / 2 + 0.01
        w = (u1 - u0) + PAD_U * 2
        h = (z1 - z0) + PAD_Z * 2
        cz = (z0 + z1) / 2
        bpy.ops.mesh.primitive_cube_add(size=1, location=((u0 + u1) / 2, cy, cz))
        box = bpy.context.object
        # size=1 的立方体半宽本来就是 0.5，缩放值就是全宽/全高
        box.scale = (w, DEPTH, h)
        bpy.ops.object.transform_apply(scale=True)
        fillers.append(box)
        n_band += 1

    if not fillers:
        print('没有需要填补的缝隙')
        return

    # 合并为一个对象并指定墙色
    bpy.ops.object.select_all(action='DESELECT')
    for b in fillers:
        b.select_set(True)
    bpy.context.view_layer.objects.active = fillers[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = 'WALL_gapfill'
    obj['part_category'] = 'wall'
    obj.data.materials.clear()
    if wall_mat:
        obj.data.materials.append(wall_mat)
    print(f'填补 {len(SLITS)} 道缝 / {n_band} 段 -> {obj.name}')

    bpy.ops.wm.save_as_mainfile(filepath=ROOT_BLEND, check_existing=False)
    print(f'已保存 {ROOT_BLEND}')


if __name__ == '__main__':
    main()
