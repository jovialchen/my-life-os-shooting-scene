"""检查 models/island.glb：节点名、custom properties (extras)、材质。

纯 Python，无需 Blender。用法: py tools/check_island_glb.py
"""
import json
import os
import struct
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GLB = os.path.join(ROOT, 'models', 'island.glb')

with open(GLB, 'rb') as f:
    magic, version, length = struct.unpack('<4sII', f.read(12))
    assert magic == b'glTF', '不是 GLB 文件'
    chunk_len, chunk_type = struct.unpack('<I4s', f.read(8))
    assert chunk_type == b'JSON'
    gltf = json.loads(f.read(chunk_len))

ok = True

print('== 节点 ==')
walk_found = 0
leaves_found = 0
trunk_found = 0
for node in gltf.get('nodes', []):
    name = node.get('name', '?')
    mesh_idx = node.get('mesh')
    extras = {}
    if mesh_idx is not None:
        extras = gltf['meshes'][mesh_idx].get('extras', {})
    extras = extras or node.get('extras', {})
    print(f'  {name:22s} extras={extras}')
    if name.startswith('WALK_'):
        walk_found += 1
        if extras.get('surface_walkable') is not True:
            print(f'    !! {name} 缺 surface_walkable=True')
            ok = False
    if name.endswith('_leaves'):
        leaves_found += 1
        if extras.get('season_leaves') is not True:
            print(f'    !! {name} 缺 season_leaves=True')
            ok = False
    if name.endswith('_trunk'):
        trunk_found += 1
        if extras:
            print(f'    !! {name} 不应有 extras（会自动变障碍，但应保持干净）')

print(f'\nWALK_ 节点: {walk_found}, 树叶: {leaves_found}, 树干: {trunk_found}')
if walk_found != 1 or leaves_found < 3 or trunk_found != leaves_found:
    ok = False

print('\n== 材质 ==')
for mat in gltf.get('materials', []):
    pbr = mat.get('pbrMetallicRoughness', {})
    print(f"  {mat.get('name')}: baseColor={pbr.get('baseColorFactor')} "
          f"rough={pbr.get('roughnessFactor')} metal={pbr.get('metallicFactor')}")

# 校验 WALK 顶面范围（accessor min/max，glTF 是 Y-up，Y=Blender z）
print('\n== WALK 顶面范围（glTF Y-up: x, y=高度, z=-Blender.y）==')
for node in gltf.get('nodes', []):
    if node.get('name', '').startswith('WALK_'):
        mesh = gltf['meshes'][node['mesh']]
        acc = gltf['accessors'][mesh['primitives'][0]['attributes']['POSITION']]
        print(f"  min={acc['min']} max={acc['max']}")
        cx = (acc['min'][0] + acc['max'][0]) / 2
        cz = (acc['min'][2] + acc['max'][2]) / 2
        rx = (acc['max'][0] - acc['min'][0]) / 2
        y_min, y_max = acc['min'][1], acc['max'][1]
        print(f'  → three 中心=({cx}, {cz}) 半径≈{rx:.2f} '
              f'高度 y∈[{y_min:.3f}, {y_max:.3f}]')
        # 起伏地形：顶面在 -0.01 基准上下波动（幅度 ~±0.4），中心/半径不变
        if not (abs(cx) < 0.01 and abs(cz - 5.0) < 0.01
                and abs(rx - 25.0) < 0.01
                and -0.45 < y_min < -0.01 <= y_max < 0.45):
            print('    !! 与岛屿参数（中心(0,5) 半径25 基准顶面-0.01 ±起伏）不符')
            ok = False

print('\n结果:', 'PASS' if ok else 'FAIL')
sys.exit(0 if ok else 1)
