"""添加可行走面 + 楼梯（task 10）：

1. WALK_floors：抽取 FLOOR_01 所有朝上面（nz>0.7），复制为
   WALK_floors（surface_walkable=True），JS 端隐藏只作导航数据。
2. 打开楼梯井（删除井道内的楼板托梁/封边/装饰斜板）。
3. 楼梯：西北角楼梯井（x -1.5..-0.5, y 3.2..4.9，2F/阁楼楼板开口）
   内做双折返楼梯：
   - A 段：后厅 1F(y=1.3,z=0.06) -> 平台(y=3.2,z=1.35)（北行，37°）
   - 平台：y 3.2..3.5, z=1.35（上方净空 >1.6）
   - B 段：平台(y=3.5,z=1.35) -> 2F 楼板 B 西缘(y=4.85,z=3.18)（北行，51°）
   路线：门廊 -> 翼门 -> 翼 1F -> 后厅 -> A/B 段 -> 2F 楼板 B
   -> 中厅 2F -> 东翼门洞(x≈3.57,y≈-0.6)。
   （阁楼暂不通楼梯：井道仅 0.8m 宽，第二折返净空不足，属后续改造。）
   踏步为可见几何（MAT_trim 深木），配斜坡 WALK 面
   （navmesh 从顶点 Y 取高度，比踏步更平滑）。
4. WALK_threshold_±1：两个翼门门口的过渡面（门槛会封岛面高度格）。

管线顺序（重新生成 models/house.glb）：
  blender -b models_src/house.blend       --python tools/split_house.py
  blender -b models_src/house-split.blend --python tools/fill_gaps.py
  blender -b models_src/house-split.blend --python tools/add_walkable.py
  blender -b models_src/house-split.blend --python tools/add_door.py
"""
import bmesh
import bpy
from mathutils import Vector

ROOT_BLEND = 'models_src/house-split.blend'

# ── 楼梯参数（世界坐标，Blender z-up）──
FA_X = (-1.35, -0.55)        # 楼梯/井 x 范围（宽 0.8m，避开西侧托梁膨胀带）
FA_Y0, FA_Z0 = 1.30, 0.06    # A 段起点（后厅 1F，楼板 A/C 下方净空够）
FA_Y1, FA_Z1 = 3.20, 1.35    # A 段终点（井口平台；板缘梁底 3.0 - 1.6 > 1.35）
LP_X = (-1.35, -0.55)        # 平台（井内，上方无楼板）
LP_Y = (3.20, 3.50)
LP_Z = 1.35
FB_Y0, FB_Z0 = 3.50, 1.35    # B 段起点（平台，北行）
FB_Y1, FB_Z1 = 4.85, 3.18    # B 段终点（2F 楼板 B 西缘，东出上板）

STEP_RISE = 0.182         # 踏步高
WALK_LIFT = 0.08          # WALK 斜坡面抬升（高过踏面沿，防止踏步净空判定封坡面）


def make_box(name, x0, x1, y0, y1, z0, z1, mat):
    bpy.ops.mesh.primitive_cube_add(size=1, location=((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))
    o = bpy.context.object
    o.name = name
    o.scale = (x1 - x0, y1 - y0, z1 - z0)   # size=1 半宽 0.5，缩放值即全宽
    bpy.ops.object.transform_apply(scale=True)
    if mat:
        o.data.materials.append(mat)
    return o


def make_walk_slope(name, x0, x1, y0, z0, y1, z1, mat):
    """斜坡/水平 walkable 面：从 (y0,z0) 到 (y1,z1) 的四边形"""
    z0 += WALK_LIFT
    z1 += WALK_LIFT
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(
        [(x0, y0, z0), (x1, y0, z0), (x1, y1, z1), (x0, y1, z1)],
        [],
        [(0, 1, 2, 3)],
    )
    if mat:
        mesh.materials.append(mat)
    o = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(o)
    o['surface_walkable'] = True
    return o


def make_flight(name, x_range, y0, z0, y1, z1, mat):
    """一段直跑楼梯的可见踏步（每级一个踢面高的薄盒，坐在上级上）"""
    rise = z1 - z0
    run = y1 - y0
    n_steps = max(2, round(rise / STEP_RISE))
    parts = []
    for i in range(n_steps):
        zi = z0 + rise * (i + 1) / n_steps
        z_prev = z0 + rise * i / n_steps
        ya = y0 + run * i / n_steps
        yb = y0 + run * (i + 1) / n_steps
        parts.append(make_box(f'{name}_step{i:02d}',
                              x_range[0], x_range[1],
                              min(ya, yb) - 0.02, max(ya, yb) + 0.02,
                              z_prev - 0.03, zi, mat))
    return parts


def main():
    trim_mat = bpy.data.materials.get('MAT_trim')
    floor_mat = bpy.data.materials.get('MAT_floor')

    # ── 0. 打开楼梯井 ──
    # VOIDS：井道内的楼板托梁/封边/井口斜梁（面心判定）
    # PLATE_ZONE：装饰性大斜板（整面横跨，面心可能在区外，用包围盒判定）
    VOIDS = [
        (-2.4, -0.4, 3.0, 5.05, 2.3, 3.2),
        (-1.6, -0.3, 3.0, 3.4, 2.5, 3.15),
    ]
    for o in bpy.data.objects:
        if o.type != 'MESH' or o.name.split('_')[0] in ('DOOR', 'WALK'):
            continue
        mw = o.matrix_world
        doomed = []
        for p in o.data.polygons:
            c = mw @ p.center
            if any(v[0] < c.x < v[1] and v[2] < c.y < v[3] and v[4] < c.z < v[5]
                   for v in VOIDS):
                doomed.append(p)
                continue
            # 装饰大斜板：y≈3.2 的薄板、z 跨 >1.5、x 跨 >2（横跨井口，非楼梯）
            vs = [mw @ o.data.vertices[vi].co for vi in p.vertices]
            ys = [v.y for v in vs]
            zs = [v.z for v in vs]
            xs = [v.x for v in vs]
            if (3.05 < min(ys) and max(ys) < 3.35
                    and max(zs) - min(zs) > 1.5
                    and max(xs) - min(xs) > 2.0
                    and max(xs) > -0.6 and min(xs) < -0.5):
                doomed.append(p)
        if doomed:
            bm = bmesh.new()
            bm.from_mesh(o.data)
            faces = {f.index: f for f in bm.faces}
            for p in doomed:
                if p.index in faces:
                    bm.faces.remove(faces[p.index])
            bm.to_mesh(o.data)
            bm.free()
            print(f'楼梯井开口: {o.name} 删除 {len(doomed)} 面')

    # ── 1. 抽取楼板/台面朝上面 -> WALK_floors ──
    # FLOOR_01（楼板）+ WALL_01/TRIM_01 的朝上面（nz>0.7 且 z<5：
    # 门廊台阶台面、板缘等；避开阁楼天花板底面与屋顶）
    verts = []
    faces = []
    vmap = {}
    for src_name in ('FLOOR_01', 'WALL_01', 'TRIM_01'):
        src = bpy.data.objects.get(src_name)
        if not src:
            continue
        mw = src.matrix_world
        rot = mw.to_3x3()
        bm = bmesh.new()
        bm.from_mesh(src.data)
        for f in bm.faces:
            n = (rot @ f.normal).normalized()
            if n.z < 0.7:
                continue
            c = mw @ f.calc_center_median()
            if src_name != 'FLOOR_01' and c.z >= 5.0:
                continue
            idx = []
            for v in f.verts:
                w = mw @ v.co
                key = (round(w.x, 5), round(w.y, 5), round(w.z, 5))
                if key not in vmap:
                    vmap[key] = len(verts)
                    verts.append(key)
                idx.append(vmap[key])
            faces.append(idx)
        bm.free()
    mesh = bpy.data.meshes.new('WALK_floors')
    mesh.from_pydata(verts, [], faces)
    if floor_mat:
        mesh.materials.append(floor_mat)
    walk_floors = bpy.data.objects.new('WALK_floors', mesh)
    bpy.context.scene.collection.objects.link(walk_floors)
    walk_floors['surface_walkable'] = True
    print(f'WALK_floors: {len(faces)} 面')

    # ── 1.5 门口过渡条：门槛(z≈0.15)会把岛面高度(-0.01)的格子封死，
    #    而门洞内没有室内楼板面(0.135)，补一块 WALK 过渡面
    for dx in (1, -1):
        make_walk_slope(f'WALK_threshold_{dx}',
                        min(dx * 5.90, dx * 7.15), max(dx * 5.90, dx * 7.15),
                        -4.10, 0.06, -3.75, 0.06, floor_mat)

    # ── 2. 楼梯（井内双折返：A 段 + 平台 + B 段）──
    stair_parts = []
    # A 段 1F -> 平台
    stair_parts += make_flight('STAIRS_fa', FA_X, FA_Y0, FA_Z0, FA_Y1, FA_Z1, trim_mat)
    make_walk_slope('WALK_stairs_fa', FA_X[0], FA_X[1],
                    FA_Y0, FA_Z0, FA_Y1, FA_Z1, floor_mat)
    # 平台
    stair_parts.append(make_box('STAIRS_lp', LP_X[0], LP_X[1], LP_Y[0], LP_Y[1],
                                LP_Z - 0.12, LP_Z, trim_mat))
    make_walk_slope('WALK_lp', LP_X[0], LP_X[1],
                    LP_Y[0], LP_Z - WALK_LIFT + 0.10,
                    LP_Y[1], LP_Z - WALK_LIFT + 0.10, floor_mat)
    # B 段 平台 -> 2F（南行折返）
    stair_parts += make_flight('STAIRS_fb', FA_X, FB_Y0, FB_Z0, FB_Y1, FB_Z1, trim_mat)
    make_walk_slope('WALK_stairs_fb', FA_X[0], FA_X[1],
                    FB_Y0, FB_Z0, FB_Y1, FB_Z1, floor_mat)

    # 合并可见踏步
    bpy.ops.object.select_all(action='DESELECT')
    for o in stair_parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = stair_parts[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = 'STAIRS_01'
    obj['part_category'] = 'trim'
    # 踏步障碍不膨胀：楼梯坡度陡，角色半径膨胀会把上一级踏步的
    # 净空判定扩散到坡面格上，导致坡面被自己的踏步封死
    obj['nav_no_inflate'] = True
    print(f'楼梯: {len(stair_parts)} 个部件 -> STAIRS_01')

    bpy.ops.wm.save_as_mainfile(filepath=ROOT_BLEND, check_existing=False)
    print(f'已保存 {ROOT_BLEND}')


if __name__ == '__main__':
    main()
