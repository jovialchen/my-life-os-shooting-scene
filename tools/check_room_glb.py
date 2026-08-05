"""检查房间 GLB（阶段 3 样板间规范，仿 check_island_glb.py）。

阶段 2.5（plan-0805）：窗景片按 doc/house-map.md 对应表逐房断言——
有窗房校验 VIEW_ 片位置（墙/组中心），无窗房（卫生间×4）不允许有 VIEW_ 片。

用法: py tools/check_room_glb.py [glb路径]   默认 models/room_living.glb
"""
import json
import os
import struct
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GLB = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'models', 'room_living.glb')

# 各房窗景片期望（doc/house-map.md 对应表）：墙 + 窗组中心 x；None = 无窗房
VIEW_EXPECT = {
    'room_living.glb': ('N', -1.45),
    'room_kitchen.glb': ('N', -0.45),
    'room_bath_f1.glb': None,
    'room_study.glb': ('S', 1.95),
    'room_bed1.glb': ('N', 0.55),
    'room_bed2.glb': ('N', 0.55),
    'room_bed3.glb': ('S', 0.0),
    'room_bath1.glb': None,
    'room_bath2.glb': None,
    'room_bath3.glb': None,
    'room_game_a.glb': ('N', -0.95),
    'room_game_b.glb': ('N', 0.0),
}

# 实体楼梯（plan-0805 阶段 2.3）：客厅↔学习室、学习室↔阁楼两组
STAIRS_EXPECT = {'room_living.glb', 'room_study.glb'}
# 阁楼人字坡顶（阶段 2.2）：坡面在 CEILING 节点里
GABLE_EXPECT = {'room_game_a.glb', 'room_game_b.glb'}

with open(GLB, 'rb') as f:
    magic, version, length = struct.unpack('<4sII', f.read(12))
    assert magic == b'glTF', '不是 GLB 文件'
    chunk_len, chunk_type = struct.unpack('<I4s', f.read(8))
    assert chunk_type == b'JSON'
    gltf = json.loads(f.read(chunk_len))

ok = True


def fail(msg):
    global ok
    print(f'  !! {msg}')
    ok = False


print(f'== {os.path.basename(GLB)} 节点 ==')
walk_nodes = []
door_nodes = []
view_nodes = []
for node in gltf.get('nodes', []):
    name = node.get('name', '?')
    extras = node.get('extras', {})
    print(f'  {name:18s} extras={extras}')
    if name.startswith('WALK_'):
        walk_nodes.append((name, node))
        if extras.get('surface_walkable') is not True:
            fail(f'{name} 缺 surface_walkable=True')
    if extras.get('interactable_type') == 'door':
        door_nodes.append((name, node))
        if not extras.get('door_target_scene'):
            fail(f'{name} 缺 door_target_scene（门=传送点）')
        if not extras.get('door_target_spawn'):
            fail(f'{name} 缺 door_target_spawn')
    if name.startswith('VIEW_'):
        view_nodes.append((name, node))
        if extras.get('nav_ignore') is not True:
            fail(f'{name} 窗景片应标 nav_ignore')

if not walk_nodes:
    fail('缺 WALK_ 可行走面')
if not door_nodes:
    fail('缺门节点')

# 实体楼梯断言（客厅/学习室必有 STAIRS 节点，其余房间不应有）
base = os.path.basename(GLB)
has_stairs = any(n.get('name') == 'STAIRS' for n in gltf.get('nodes', []))
if base in STAIRS_EXPECT and not has_stairs:
    fail('缺 STAIRS 实体楼梯节点（plan-0805 阶段 2.3）')
if base not in STAIRS_EXPECT and has_stairs:
    fail('该房不应有 STAIRS 节点')

# 阁楼坡顶断言（游戏室A/B 的 CEILING 应为坡面：bbox 含屋脊高 3.2）
if base in GABLE_EXPECT:
    ceil = next((n for n in gltf.get('nodes', []) if n.get('name') == 'CEILING'), None)
    if not ceil:
        fail('缺 CEILING 节点')
    else:
        mesh = gltf['meshes'][ceil['mesh']]
        hi = max(gltf['accessors'][pr['attributes']['POSITION']]['max'][1]
                 for pr in mesh['primitives'])
        if hi < 3.1:
            fail(f'阁楼 CEILING 应为人字坡顶（屋脊 3.2），实测顶 y={hi:.2f}')

# 窗景片按对应表断言（有窗房：位置/墙；无窗房：不应存在）
expect = VIEW_EXPECT.get(os.path.basename(GLB), 'unknown')
if expect == 'unknown':
    print('  （未登记的 glb，跳过窗景片断言）')
elif expect is None:
    if view_nodes:
        fail(f'无窗房不应有 VIEW_ 窗景片: {[n for n, _ in view_nodes]}')
else:
    exp_wall, exp_cx = expect
    if len(view_nodes) != 1:
        fail(f'应有 1 片 VIEW_ 窗景片（实际 {len(view_nodes)}）')
    else:
        name, node = view_nodes[0]
        mesh = gltf['meshes'][node['mesh']]
        acc = gltf['accessors'][mesh['primitives'][0]['attributes']['POSITION']]
        cx = (acc['min'][0] + acc['max'][0]) / 2
        cz = (acc['min'][2] + acc['max'][2]) / 2
        wall = 'S' if cz < 0 else 'N'
        if wall != exp_wall:
            fail(f'{name} 墙错误：期望 {exp_wall} 墙，实际 {wall} 墙（z={cz:.2f}）')
        if abs(cx - exp_cx) > 0.05:
            fail(f'{name} 窗组中心 x 期望 {exp_cx}，实际 {cx:.2f}')

print('\n== WALK 面范围 ==')
for name, node in walk_nodes:
    mesh = gltf['meshes'][node['mesh']]
    acc = gltf['accessors'][mesh['primitives'][0]['attributes']['POSITION']]
    print(f"  {name}: min={[round(v,3) for v in acc['min']]} max={[round(v,3) for v in acc['max']]}")
    if not (0.005 <= acc['min'][1] <= acc['max'][1] <= 0.05):
        fail(f'{name} 逻辑面应抬高 0.01~0.02（实测 y {acc["min"][1]}..{acc["max"][1]}）')

print('\n== 材质 ==')
mat_names = set()
for mat in gltf.get('materials', []):
    pbr = mat.get('pbrMetallicRoughness', {})
    mat_names.add(mat.get('name'))
    print(f"  {mat.get('name')}: rough={pbr.get('roughnessFactor')} metal={pbr.get('metallicFactor')}")
    if pbr.get('roughnessFactor') != 1.0 or pbr.get('metallicFactor') != 0.0:
        fail(f"{mat.get('name')} 应为平涂 rough=1 metal=0")
if 'MAT_window_view' not in mat_names:
    fail('缺 MAT_window_view（时间系统按名联动变色）')

print('\n结果:', 'PASS' if ok else 'FAIL')
sys.exit(0 if ok else 1)
