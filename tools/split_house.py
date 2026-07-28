"""house.blend 部件分类 + 平涂着色 + 拆分导出。

策略（针对该模型的实际情况）:
  - 整个房子是 1 个 mesh、4667 个松散块（屋顶瓦片是几千个独立小块）
  - 不逐块拆 object，而是 bmesh 连通块分析 → 按几何特征分类 → 按面写材质槽
  - 分类: roof / floor / wall / door / window / trim
  - 密排竖梁隔一根删一根（间距 ~0.25m 的深色细条太多，墙面显得乱），
    每面墙保留首尾两列和通高角柱，并以左半墙为基准镜像对称
  - 背坡右半缺失的 5 根长斜梁从左半镜像补齐
  - 屋顶/地板的内侧可见面（阁楼天花板、各层顶棚）改刷屋内色(wall)，
    外侧面保持屋顶红/地板木色
  - 最后按材质拆成 6 个 object，导出 GLB

用法: tools/blender.sh -b models_src/house.blend --python tools/split_house.py
"""
import os
import sys

import bpy
import bmesh
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from flat_materials import build_all_materials

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_BLEND = os.path.join(ROOT, 'models_src', 'house-split.blend')
OUT_GLB = os.path.join(ROOT, 'models_src', 'house-split.glb')

# 材质槽顺序固定，分类名 -> 槽位
SLOTS = ['wall', 'roof', 'floor', 'door', 'window', 'trim']


def find_components(obj):
    """bmesh 连通块分析，返回 [(faces, stats), ...]（世界坐标统计）。"""
    mw = obj.matrix_world
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.faces.ensure_lookup_table()

    visited = set()
    comps = []
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
            comp.append(f.index)
            for v in f.verts:
                for lf in v.link_faces:
                    if lf.index not in visited:
                        stack.append(lf)
        pts = [mw @ bm.faces[i].verts[0].co for i in comp]
        pts = [mw @ v.co for i in comp for v in bm.faces[i].verts]
        mins = Vector((min(p[j] for p in pts) for j in range(3)))
        maxs = Vector((max(p[j] for p in pts) for j in range(3)))
        size = maxs - mins
        up = sum(1 for i in comp
                 if (mw.to_3x3() @ bm.faces[i].normal).normalized().z > 0.5)
        comps.append((comp, {
            'n': len(comp), 'mins': mins, 'maxs': maxs, 'size': size,
            'up': up / len(comp), 'zmid': (mins.z + maxs.z) / 2,
            'thin': min(size.x, size.y, size.z),
            'area': max(size.x * size.y, size.x * size.z, size.y * size.z),
        }))
    bm.free()
    return comps


def classify(s):
    """按连通块几何特征分类。

    该模型的关键尺寸特征（实测）:
    - 窗格/玻璃: 厚度仅 0.03m 的小薄板（d1<=0.06），必须最先判，
      否则山墙上的窗格会因 up>0.15 被误判成屋顶
    - 屋顶瓦: 高处(z>6)斜朝上面片，up>0.15，厚度 ~0.4
    - 地板: 水平薄板(z<0.2 厚)，面积>4
    - 墙板: 板状（次大边>0.8m），厚 0.1~0.45
    - 木架/装饰条: 细长条（次大边<0.8），半木结构风格
    """
    sz, up, zmid = s['size'], s['up'], s['zmid']
    d1, d2, d3 = sorted([sz.x, sz.y, sz.z])
    # 1. 窗格/玻璃: 极薄小板
    if d1 <= 0.06 and d3 <= 1.2 and s['area'] < 1.2:
        # 山墙尖窗之间的拱肩是实心小板（n<=8 的完整板件），
        # 不是镂空格栅(n=26) —— 归墙，刷山墙白色
        if s['n'] <= 8:
            return 'wall'
        return 'window'
    # 2. 地板: 水平薄板，大面积（必须在屋顶规则之前，
    #    否则 z>6 的阁楼地板会因 up>0.15 被误判成屋顶）
    if sz.z < 0.2 and s['area'] > 4:
        return 'floor'
    # 3. 山墙区域(两翼前端 y<-4.8、z>6)：
    #    - 竖直山墙板(y 向薄、z 跨度大) -> wall 米白
    #    - 其余(斜向封边板/檐口板/椽尾/窗套板) -> trim 深木色，
    #      与半木结构木架同色，不再用屋顶红
    if s['maxs'].y < -4.8 and s['mins'].z > 6.0:
        if sz.y < 0.3 and sz.z > 1.5:
            return 'wall'
        return 'trim'
    # 4. 屋顶: 高处以斜朝上为主的面片
    if zmid > 6.0 and up > 0.15:
        return 'roof'
    # 4b. 屋顶附件: 完全位于 z>6 的非窗构件（坡面斜梁/底板等侧立板，
    #     面法线朝上比例低，会被规则 6 误判成白墙）
    if s['mins'].z > 6.0:
        return 'roof'
    # 5. 门: 落地的竖直薄板，比墙板更薄更矮（该模型可能没有门板，是开放门洞）
    if (s['mins'].z < 0.45 and 1.7 < sz.z < 2.5 and up < 0.3
            and d1 <= 0.12 and 1.0 < s['area'] < 3.0):
        return 'door'
    # 6. 墙: 板状（两个方向都大），较薄
    if d2 > 0.8 and d1 < 0.45 and up < 0.45:
        return 'wall'
    # 7. 其余: 木架条、装饰件
    return 'trim'


def pick_redundant_vbars(comps):
    """选出要删掉的密排竖梁面片（隔一根删一根）。

    竖梁特征（实测）: trim 类、高 ~3m（2~4m，排除 6.8m 通高角柱）、
    水平截面 <0.3m。密排竖梁都在沿 X 走向的墙上（y 恒定，间距 ~0.25m），
    按墙平面(y)分组、按 x 分列，删奇数列但保留每面墙的首尾两列。
    同一列上下两层的梁一起删，避免错位。
    最后以左半墙(x<0)为基准把保留/删除决定镜像到右半墙，保证左右对称。
    """
    from collections import defaultdict
    columns = defaultdict(list)  # (y墙, x列) -> face indices
    for comp, s in comps:
        if classify(s) != 'trim':
            continue
        sz = s['size']
        if not (2.0 < sz.z < 4.0) or max(sz.x, sz.y) > 0.3:
            continue
        cx = (s['mins'].x + s['maxs'].x) / 2
        cy = (s['mins'].y + s['maxs'].y) / 2
        columns[(round(cy, 1), round(cx, 2))].extend(comp)

    walls = defaultdict(list)  # y墙 -> [(x列, faces)]
    for (wy, wx), faces in columns.items():
        walls[wy].append((wx, faces))
    delete = set()
    for wy, cols in walls.items():
        cols.sort()
        keep, drop = set(), set()
        for i, (wx, faces) in enumerate(cols):
            (drop if 0 < i < len(cols) - 1 and i % 2 == 1 else keep).add(wx)
        # 镜像对称化：左列的决定覆盖最近的镜像右列
        xs = [wx for wx, _ in cols]
        for wx in xs:
            if wx >= 0:
                continue
            mirror = min((x for x in xs if x > 0),
                         key=lambda x: abs(x + wx), default=None)
            if mirror is None or abs(mirror + wx) > 0.12:
                continue
            if wx in keep:
                keep.add(mirror)
                drop.discard(mirror)
            else:
                drop.add(mirror)
                keep.discard(mirror)
        for wx, faces in cols:
            if wx in drop:
                delete.update(faces)
    return delete


def mirror_ribs(comps, obj):
    """把背坡左侧(x<-3)的长斜梁镜像补到右侧(+x)。

    源模型只有左半坡有 5 根斜梁(x=-8.35..-4.00)，右半坡缺失。
    斜梁特征: 底端 z≈6.71、前端 y≈5.33、z 向跨度>1.5、x 向很窄(<1m，
    借此排除同区域的坡面底板大块)。镜像绕 x=0 平面，
    翻转面绕向保持法线朝外。返回新增面数。
    """
    rib_faces = []
    for comp, s in comps:
        if classify(s) != 'roof':
            continue
        if (abs(s['mins'].z - 6.71) > 0.05 or s['maxs'].y < 5.3
                or s['size'].z < 1.5 or s['size'].x > 1.0):
            continue
        cx = (s['mins'].x + s['maxs'].x) / 2
        if -9.0 < cx < -3.5:
            rib_faces.extend(comp)
    if not rib_faces:
        return 0
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.faces.ensure_lookup_table()
    geom = [bm.faces[i] for i in rib_faces]
    geom += list({e for f in geom for e in f.edges})
    geom += list({v for f in geom for v in f.verts})
    dup = bmesh.ops.duplicate(bm, geom=geom)
    new_faces = [g for g in dup['geom']
                 if isinstance(g, bmesh.types.BMFace)]
    for g in dup['geom']:
        if isinstance(g, bmesh.types.BMVert):
            g.co.x = -g.co.x
    bmesh.ops.reverse_faces(bm, faces=new_faces)
    bm.to_mesh(obj.data)
    bm.free()
    return len(new_faces)


def adjust_interior_faces(obj, face_cat):
    """把屋顶/地板的内侧可见面改刷屋内色(wall)，返回改色面数。

    屋顶和地板在 Blender 里是双面渲染的薄板，外侧面和内侧面共用材质：
    - 屋顶面朝下(nz<-0.3)、z>6、在房屋平面范围内 -> 阁楼天花板(屋内色)；
      范围限制避免把屋檐外侧的挑檐底面(soffit)也刷成屋内色
    - 地板面朝下(nz<-0.5)、z>1.5 -> 下层房间的天花板(一楼地板底面
      在地面以下不可见，不动)
    """
    mw = obj.matrix_world
    rot = mw.to_3x3()
    n = 0
    for p in obj.data.polygons:
        cat = face_cat.get(p.index)
        if cat not in ('roof', 'floor'):
            continue
        nz = (rot @ p.normal).normalized().z
        c = mw @ p.center
        if cat == 'roof':
            if nz < -0.3 and c.z > 6.0 \
                    and abs(c.x) < 9.3 and -5.0 < c.y < 4.9:
                face_cat[p.index] = 'wall'
                n += 1
        elif nz < -0.5 and c.z > 1.5:
            face_cat[p.index] = 'wall'
            n += 1
    return n


def main():
    obj = next(o for o in bpy.data.objects if o.type == 'MESH')
    print(f'分析 {obj.name}: {len(obj.data.polygons)} 面')
    comps = find_components(obj)
    print(f'{len(comps)} 个连通块')

    # 删掉密排竖梁的奇数列，再重新分析（面索引会变）
    del_faces = pick_redundant_vbars(comps)
    print(f'删除冗余竖梁: {len(del_faces)} 面')
    if del_faces:
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bm.faces.ensure_lookup_table()
        bmesh.ops.delete(bm, geom=[bm.faces[i] for i in del_faces],
                         context='FACES')
        bm.to_mesh(obj.data)
        bm.free()
        comps = find_components(obj)
        print(f'删除后 {len(comps)} 个连通块')

    # 补齐右半坡缺失的斜梁（镜像左半坡），再重新分析（面索引会变）
    n_new = mirror_ribs(comps, obj)
    print(f'镜像斜梁: 新增 {n_new} 面')
    if n_new:
        comps = find_components(obj)
        print(f'镜像后 {len(comps)} 个连通块')

    # 分类统计
    face_cat = {}
    from collections import Counter
    cnt_parts, cnt_faces = Counter(), Counter()
    for comp, s in comps:
        cat = classify(s)
        cnt_parts[cat] += 1
        cnt_faces[cat] += s['n']
        for fi in comp:
            face_cat[fi] = cat
    print('部件数:', dict(cnt_parts))
    print('面数:', dict(cnt_faces))

    # 屋顶/地板的内侧可见面改刷屋内色
    n_in = adjust_interior_faces(obj, face_cat)
    print(f'内侧面改色: {n_in} 面')

    # 建材质 + 材质槽
    mats = build_all_materials()
    # 补充地板色
    from flat_materials import make_flat_material
    mats['MAT_floor'] = make_flat_material('MAT_floor', '#C9A876')
    slot_mat = {
        'wall': mats['MAT_wall'], 'roof': mats['MAT_roof'],
        'floor': mats['MAT_floor'], 'door': mats['MAT_door'],
        # 窗户是镂空格栅没有玻璃，刷窗框暖白而不是玻璃蓝（MAT_glass 弃用）
        'window': mats['MAT_frame'], 'trim': mats['MAT_trim'],
    }
    obj.data.materials.clear()
    for cat in SLOTS:
        obj.data.materials.append(slot_mat[cat])
    for p in obj.data.polygons:
        p.material_index = SLOTS.index(face_cat.get(p.index, 'trim'))

    # 按材质拆成独立 object
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.separate(type='MATERIAL')
    bpy.ops.object.mode_set(mode='OBJECT')

    for o in bpy.data.objects:
        if o.type != 'MESH' or not o.data.materials:
            continue
        cat = next((c for c, m in slot_mat.items()
                    if m == o.data.materials[0]), 'trim')
        o.name = cat.upper() + '_01'
        o['part_category'] = cat
        print(f'{o.name:10s} faces={len(o.data.polygons)}')

    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND, check_existing=False)
    bpy.ops.export_scene.gltf(
        filepath=OUT_GLB, export_format='GLB',
        export_apply=True, export_animations=False, export_yup=True,
    )
    print(f'已保存 {OUT_BLEND}')
    print(f'已导出 {OUT_GLB}')


if __name__ == '__main__':
    main()
