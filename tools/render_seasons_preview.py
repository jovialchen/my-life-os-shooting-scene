"""四季花园预览：模拟 JS 季节系统的状态（树叶变色/落叶、果、雪、花、雪人）。

用法: tools/blender.sh -b models_src/island.blend --python tools/render_seasons_preview.py
"""
import math
import os

import bpy
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tools', 'preview')
os.makedirs(OUT, exist_ok=True)

# 导入房子做参照
bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT, 'models', 'house.glb'))

cam_data = bpy.data.cameras.new('Cam')
cam = bpy.data.objects.new('Cam', cam_data)
bpy.context.scene.collection.objects.link(cam)
bpy.context.scene.camera = cam

sun_data = bpy.data.lights.new('Sun', type='SUN')
sun_data.energy = 4.0
sun = bpy.data.objects.new('Sun', sun_data)
sun.rotation_euler = (math.radians(50), 0, math.radians(30))
bpy.context.scene.collection.objects.link(sun)

world = bpy.data.worlds.new('W')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (0.75, 0.82, 0.9, 1)
bpy.context.scene.world = world

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 32
scene.render.resolution_x = 1280
scene.render.resolution_y = 800

SUMMER_LEAF = '#3e7c33'
PINE_WINTER = '#2e5a30'
# 季节 → (草地色, 落叶树叶色来源, 是否落叶, 果, 雪, 雪人, 花期的季节值)
SEASONS = {
    'spring': ('#7acc68', 'spring', False, False, False, False, 0.3),
    'summer': ('#4a8c3f', None,     False, False, False, False, 1.4),
    'autumn': ('#b8a040', 'autumn', False, True,  False, False, 2.2),
    'winter': ('#e8e8e8', None,     True,  False, True,  True,  2.9),
}


def hex_rgba(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) / 255.0 for i in (0, 2, 4)) + (1.0,)


def color_material(name, hex_color):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    if bsdf:
        bsdf.inputs['Base Color'].default_value = hex_rgba(hex_color)
    mat.diffuse_color = hex_rgba(hex_color)
    return mat


def apply_season(key):
    grass_hex, leaf_src, bare, show_fruit, show_snow, show_snowman, sv = \
        SEASONS[key]
    mat_grass = color_material('MAT_grass', grass_hex)
    mat_leaf_summer = color_material('PV_summer', SUMMER_LEAF)
    mat_pine_winter = color_material('PV_pine_winter', PINE_WINTER)

    for obj in bpy.data.objects:
        ud = obj  # custom props 在 object 上
        name = obj.name
        if name.startswith('WALK_'):
            obj.hide_render = True
            continue
        if 'island_ground' in name or 'GRASS_tufts' in name:
            for slot in obj.material_slots:
                if slot.material and slot.material.name == 'MAT_grass':
                    slot.material = mat_grass
            obj.hide_render = False
        elif ud.get('season_leaves'):
            ttype = ud.get('tree_type', 'deciduous')
            if ttype == 'pine':
                obj.hide_render = False
                obj.material_slots[0].material = (
                    mat_pine_winter if bare else mat_leaf_summer)
            else:
                obj.hide_render = bare
                if not bare:
                    src = ud.get('leaf_spring' if leaf_src == 'spring'
                                 else 'leaf_autumn', '#4f7f3f')
                    obj.material_slots[0].material = (
                        color_material(f'PV_{name}', src) if leaf_src
                        else mat_leaf_summer)
        elif ud.get('season_fruits'):
            obj.hide_render = not show_fruit
        elif ud.get('season_snow'):
            obj.hide_render = not show_snow
        elif ud.get('season_snowman'):
            obj.hide_render = not show_snowman
        elif ud.get('flower_bloom_in') is not None:
            obj.hide_render = not (ud['flower_bloom_in'] <= sv
                                   <= ud['flower_bloom_out'])


def look_at(obj, target):
    d = Vector(target) - obj.location
    obj.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()


# 花园低角度（四季对比）+ 夏季俯视
VIEWS = [
    ('sw', (-22, -28, 9), (0, -2, 1)),
    ('top', (0, -5, 55), (0, -5, 0)),
]

for season in SEASONS:
    apply_season(season)
    for vname, loc, target in VIEWS:
        if vname == 'top' and season != 'summer':
            continue
        cam.location = loc
        look_at(cam, target)
        scene.render.filepath = os.path.join(
            OUT, f'season_{season}_{vname}.png')
        bpy.ops.render.render(write_still=True)
        print('rendered', season, vname)
