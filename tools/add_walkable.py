"""添加可行走面 + 楼梯（task 10）：

1. WALK_floors：抽取 FLOOR_01 所有朝上面（nz>0.7），复制为
   WALK_floors（surface_walkable=True），JS 端隐藏只作导航数据。
2. 打开楼梯井（删除井道内的楼板托梁/封边/装饰斜板）。
3. 楼梯（原模型自带白色踏步，北墙 y≈4.0 东西向直跑）：
   - 第一跑 1F(x≈-5.4,z=0.13) -> 东行上行，原资产在 x=-2.04 处
     装饰性中断（距 2F 还差 5 级），补 5 级白色踏步接通 2F 楼板
   - 第二跑 2F(x≈-5.4,z=3.19) -> 阁楼(z=6.17)，原模型完整
   路线：门廊 -> 翼门 -> 翼 1F -> 后厅 -> 第一跑 -> 2F 楼板
   -> 中厅 2F -> 东翼门洞(x≈3.57,y≈-0.6)。
   （阁楼仍不通导航：第二跑暂不配 WALK 面，属后续改造。）
   新增踏步为可见几何（MAT_wall 白色，与原踏步一致），第一跑配
   斜坡 WALK 面（navmesh 从顶点 Y 取高度，比踏步更平滑）。
4. WALK_threshold_±1：两个翼门门口的过渡面（门槛会封岛面高度格）。

管线顺序（重新生成 models/house.glb）：
  blender -b models_src/house.blend       --python tools/split_house.py
  blender -b models_src/house-split.blend --python tools/fill_gaps.py
  blender -b models_src/house-split.blend --python tools/add_walkable.py
  blender -b models_src/house-split.blend --python tools/add_door.py
"""
import bmesh
import bpy

ROOT_BLEND = 'models_src/house-split.blend'

# ── 白楼梯（原模型自带踏步）参数：北墙 y≈4.0 东西向直跑 ──
WS_Y = (3.26, 4.76)          # WALK 坡面 y 范围（踏面 3.22..4.80 内缩）
WS_X0, WS_Z0 = -5.51, 0.066  # 坡面西端（1F 地面，踏步线延长点）
WS_X1, WS_Z1 = -0.83, 3.06   # 坡面东端（补全后末级踏面，东出上 2F 楼板）
# 原模型第一跑在 x=-2.04 处中断（装饰性缺失），补 5 级接通 2F：
# (踏面中心 x, 踏面顶 z)，沿用原踏步 0.306 进深 / 0.194 步高；
# 末级(x=-0.67, z=3.18) 与 2F 楼板(z=3.17)齐平，南出一步上板
WS_NEW_TREADS = [(-1.89, 2.404), (-1.585, 2.598), (-1.28, 2.792),
                 (-0.975, 2.986), (-0.67, 3.180)]
WS_TREAD_W = 0.28            # 踏步 x 向宽（与原模型一致）
WS_TREAD_Y = (3.22, 4.80)    # 踏步 y 范围（与原模型一致）

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


def make_walk_slope_x(name, y0, y1, x0, z0, x1, z1, mat):
    """沿 x 向爬坡的 walkable 面：从 (x0,z0) 到 (x1,z1) 的四边形"""
    z0 += WALK_LIFT
    z1 += WALK_LIFT
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(
        [(x0, y0, z0), (x1, y0, z1), (x1, y1, z1), (x0, y1, z0)],
        [],
        [(0, 1, 2, 3)],
    )
    if mat:
        mesh.materials.append(mat)
    o = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(o)
    o['surface_walkable'] = True
    return o


def main():
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

    # ── 2. 白楼梯：补全第一跑缺失踏步 + WALK 坡面 ──
    # 原模型白色踏步（在 WALL_01 里，navmesh 不膨胀也能用——踏面顶都在
    # 坡面线下方 0.08，不触发净空剔除）；新补的 4 级单独成对象并设
    # nav_no_inflate（楼梯坡度陡，膨胀会把上一级踏步的净空判定
    # 扩散到坡面格上，导致坡面被自己的踏步封死）
    wall_mat = bpy.data.materials.get('MAT_wall')
    treads = []
    for i, (cx, top) in enumerate(WS_NEW_TREADS):
        treads.append(make_box(f'STAIRS_new{i}',
                               cx - WS_TREAD_W / 2, cx + WS_TREAD_W / 2,
                               WS_TREAD_Y[0], WS_TREAD_Y[1],
                               top - 0.06, top, wall_mat))
    bpy.ops.object.select_all(action='DESELECT')
    for o in treads:
        o.select_set(True)
    bpy.context.view_layer.objects.active = treads[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = 'STAIRS_01'
    obj['part_category'] = 'trim'
    obj['nav_no_inflate'] = True
    # 第一跑 WALK 坡面：1F(x=-5.51,z=0.13) -> 坡顶(x=-0.83,z=3.06)
    make_walk_slope_x('WALK_stairs_1f2f', WS_Y[0], WS_Y[1],
                      WS_X0, WS_Z0, WS_X1, WS_Z1, floor_mat)
    # 东向过渡面：2F 楼板北侧延伸板(x -0.51..3.66, z=3.17) 紧贴末级
    # 踏步东侧，铺一块 z=3.14 的过渡面覆盖板缝，保证坡面 -> 楼板连通。
    # （南出不可行：第二跑楼梯的阶梯状侧板在 y≈3.17 悬在 0.3~1m 高，
    #   净空不足；北侧 3.86 的窄条同理被挡）
    make_walk_slope_x('WALK_stairs_2fout', 3.30, 4.70,
                      -1.10, 3.06, -0.35, 3.06, floor_mat)
    print(f'白楼梯: 补 {len(treads)} 级踏步 -> STAIRS_01 + WALK 坡面/过渡面')

    bpy.ops.wm.save_as_mainfile(filepath=ROOT_BLEND, check_existing=False)
    print(f'已保存 {ROOT_BLEND}')


if __name__ == '__main__':
    main()
