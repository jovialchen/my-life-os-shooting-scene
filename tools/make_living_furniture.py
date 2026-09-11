"""客厅家具拼装：furnitures/*.obj → models/furniture_living.glb

从 furnitures/ 的 OBJ（无 mtl，导出时丢了材质）重建 NPR 平涂材质并摆进客厅。
家具不设 extras —— surfaceParser 默认把无标记 mesh 当导航障碍，相机碰撞
（main.js 只算 WALLS/CEILING/FLOOR/FRAMES/DOOR_）也天然跳过它们。

配色基调（与 tools/room_palette.mjs + 客厅内墙豆绿 #B5C9A4 协调）：
  暖木（胡桃 #8A5A3B / 深木 #6E4B32 / 浅橡木 #D9BC8C）
  + 燕麦/米白布艺（#CDB894 / #E7DCC3）+ 墙面同色系的鼠尾草绿靠垫（#A9BC90）
  + 一件灰珊瑚色圆墩（#C47F62）做点缀

坐标：pos/rotY 均为 three.js 房间坐标（原点在客厅南墙门口地板中心，
y 上，z 进房间；楼梯占用东墙 x3.9..5.0 / z5.9..10.66，西墙 z1.6/4.3 有门）。
脚本内部转 Blender z-up：loc=(x, -z, y)，rotation.z=rotY。

用法: tools/blender.sh -b --python tools/make_living_furniture.py
"""
import math
import os
import sys

import bpy

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
from flat_materials import make_flat_material, assign_material  # noqa: E402

OUT = os.path.join(ROOT, 'models', 'furniture_living.glb')

# ── 家具清单 ──
# mats: OBJ 子对象名 → (材质名, 颜色)
# decimate: ('COLLAPSE', ratio) 或 ('DISSOLVE', 角度rad)；NPR 要低面数
# scale: 整体放大——角色身高 1.65m，原模型按真人偏小一号的比例做的，
#        放大 ~1.2 倍后沙发座面/靠背和角色才对得上（不然"坐不下"）
#
# 布局（2026-09-10 定稿）：楼梯在 +x 墙（进门面窗左手边），会客区靠 -x 墙
# （z 5~8 段），沙发面朝 -x 墙电视柜；-x 墙走廊门在 z2.2（会客区以南，不冲突）。
FURNITURE = [
    {
        'file': 'sofa-bed-002.obj',
        'pos': (-2.55, 0.0, 7.0), 'rotY': -90, 'scale': 1.2,  # 面朝 -x 墙电视柜
        'mats': {
            'couch':   ('MAT_fab_sofa', '#CDB894'),    # 燕麦色布艺
            'base':    ('MAT_fab_sofa', '#CDB894'),
            'top':     ('MAT_fab_sofa', '#CDB894'),
            'cushions': ('MAT_fab_cushion', '#A9BC90'),  # 鼠尾草绿靠垫（呼应豆绿墙）
            'plug':    ('MAT_wood_dark', '#6E4B32'),
        },
        'decimate': ('COLLAPSE', 0.5),
    },
    {
        'file': 'tv-cabinet-002.obj',
        'pos': (-4.75, 0.0, 7.0), 'rotY': -90, 'scale': 1.2,  # 三门面（-z）朝屋内；贴 -x 墙
        'mats': {
            'cabinet': ('MAT_wood_walnut', '#8A5A3B'),  # 胡桃木（同门/踏步色系）
            'legs':    ('MAT_wood_dark', '#5F3F2A'),
        },
        'decimate': ('DISSOLVE', math.radians(5)),
    },
    {
        'file': 'table-017.obj',
        'pos': (-3.95, 0.0, 7.0), 'rotY': -90, 'scale': 1.2,  # 长边顺 z，沙发与电视柜之间
        'mats': {'table-017': ('MAT_wood_oak', '#D9BC8C')},   # 浅橡木茶几
        'decimate': ('COLLAPSE', 0.35),
    },
    {
        'file': 'pouf-001.obj',
        'pos': (-2.05, 0.0, 10.2), 'rotY': 0, 'scale': 1.15,  # 北窗组正中前的窗边坐墩（窗组偏 -x，让开 +x 墙楼梯）
        'mats': {
            'pouf':    ('MAT_fab_pouf', '#C47F62'),     # 灰珊瑚点缀色
            'blanket': ('MAT_fab_blanket', '#E7DCC3'),  # 米白搭毯
            'label':   ('MAT_wood_dark', '#6E4B32'),
        },
        'decimate': ('COLLAPSE', 0.08),   # 96k 面太重，收到 ~8k
    },
    {
        'file': 'square-ottoman-bench-001.obj',
        'pos': (-2.8, 0.0, 1.15), 'rotY': 0, 'scale': 1.2,   # 南墙西窗下小脚凳
        'mats': {
            'cushion': ('MAT_fab_blanket', '#E7DCC3'),
            'pouf':    ('MAT_fab_cushion', '#A9BC90'),
            'legs':    ('MAT_wood_dark', '#6E4B32'),
        },
        'decimate': None,
    },
]


def base_name(name):
    """去掉 Blender 重名后缀（xxx.001）"""
    head, dot, tail = name.rpartition('.')
    return head if dot and tail.isdigit() else name


def main():
    # 清空默认场景
    bpy.ops.wm.read_factory_settings(use_empty=True)

    mat_cache = {}

    def get_mat(mat_name, hex_color):
        if mat_name not in mat_cache:
            mat_cache[mat_name] = make_flat_material(mat_name, hex_color)
        return mat_cache[mat_name]

    for spec in FURNITURE:
        before = set(bpy.data.objects)
        bpy.ops.wm.obj_import(
            filepath=os.path.join(ROOT, 'furnitures', spec['file']),
            forward_axis='NEGATIVE_Z', up_axis='Y')
        objs = [o for o in bpy.data.objects if o not in before]
        assert objs, f"{spec['file']} 没有导入任何对象"

        # 家具定位锚点（three → blender：loc=(x, -z, y)，rotY → rotation.z）
        anchor = bpy.data.objects.new(f"ANCHOR_{spec['file'][:-4]}", None)
        bpy.context.scene.collection.objects.link(anchor)
        x, y, z = spec['pos']
        anchor.location = (x, -z, y)
        anchor.rotation_euler = (0, 0, math.radians(spec['rotY']))
        s = spec.get('scale', 1.0)
        anchor.scale = (s, s, s)

        total_faces = 0
        for obj in objs:
            obj.parent = anchor
            name = base_name(obj.name)
            entry = spec['mats'].get(name)
            assert entry, f"{spec['file']} 子对象 {name} 没有配色"
            assign_material(obj, get_mat(*entry))
            total_faces += len(obj.data.polygons)

        # 减面（NPR 平涂风格：低面数 + 保留平滑着色）
        if spec['decimate']:
            kind, val = spec['decimate']
            for obj in objs:
                mod = obj.modifiers.new('decimate', 'DECIMATE')
                if kind == 'DISSOLVE':
                    mod.decimate_type = 'DISSOLVE'
                    mod.angle_limit = val
                else:
                    mod.decimate_type = 'COLLAPSE'
                    mod.ratio = val
        print(f"[furniture] {spec['file']}: {len(objs)} 部件, "
              f"{total_faces} 面, pos={spec['pos']} rotY={spec['rotY']} scale={s}")

    # 导出 GLB（export_apply 应用减面修改器；+Y up 默认）
    bpy.ops.export_scene.gltf(
        filepath=OUT, export_format='GLB', export_apply=True,
        export_animations=False, export_skins=False, export_morph=False)
    size = os.path.getsize(OUT) / 1024
    print(f"[furniture] 已导出 {OUT} ({size:.0f} KB)")


main()
