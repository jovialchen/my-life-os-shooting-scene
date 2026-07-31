"""检查房间 GLB（阶段 3 样板间规范，仿 check_island_glb.py）。

用法: py tools/check_room_glb.py [glb路径]   默认 models/room_living.glb
"""
import json
import os
import struct
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GLB = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'models', 'room_living.glb')

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
view_found = False
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
        view_found = True
        if extras.get('nav_ignore') is not True:
            fail(f'{name} 窗景片应标 nav_ignore')

if not walk_nodes:
    fail('缺 WALK_ 可行走面')
if not door_nodes:
    fail('缺门节点')
if not view_found:
    fail('缺 VIEW_ 窗景片')

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
