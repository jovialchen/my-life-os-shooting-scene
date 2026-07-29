"""给拆分后的部件创建/应用 NPR 平涂材质。

被 split_house.py import，也可单独调试。
颜色方案：暖色田园（见计划文件）。
"""
import bpy

# sRGB 十六进制 -> Blender 线性 RGB
def hex_to_linear(hex_str):
    h = hex_str.lstrip('#')
    srgb = [int(h[i:i+2], 16) / 255.0 for i in (0, 2, 4)]

    def to_linear(c):
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    return tuple(to_linear(c) for c in srgb) + (1.0,)


PALETTE = {
    'MAT_wall':  '#F2E9D8',  # 米白墙面
    'MAT_roof':  '#A84E32',  # 砖红棕屋顶
    'MAT_door':  '#8A5A3B',  # 原木棕门
    'MAT_frame': '#6E4B32',  # 胡桃棕窗框（与米白墙面强对比，与门/木架同色系）
    'MAT_glass': '#A9D3DE',  # 浅青蓝玻璃
    'MAT_trim':  '#5F3F2A',  # 深木色装饰
}


def make_flat_material(name, hex_color, emission=0.0):
    """纯色平涂材质：Roughness=1, Metallic=0, Specular=0，无贴图。"""
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    # 视口显示色（Workbench/实体模式用，sRGB 直接写，不转线性）
    h = hex_color.lstrip('#')
    mat.diffuse_color = tuple(int(h[i:i+2], 16) / 255.0
                              for i in (0, 2, 4)) + (1.0,)
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Base Color'].default_value = hex_to_linear(hex_color)
    bsdf.inputs['Roughness'].default_value = 1.0
    bsdf.inputs['Metallic'].default_value = 0.0
    spec = bsdf.inputs.get('Specular IOR Level') or bsdf.inputs.get('Specular')
    if spec:
        spec.default_value = 0.0
    if emission > 0.0:
        em_col = bsdf.inputs.get('Emission Color') or bsdf.inputs.get('Emission')
        em_str = bsdf.inputs.get('Emission Strength')
        if em_col:
            em_col.default_value = hex_to_linear(hex_color)
        if em_str:
            em_str.default_value = emission
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    return mat


def assign_material(obj, mat):
    """清掉物体原有材质槽，只留一个平涂材质。"""
    obj.data.materials.clear()
    obj.data.materials.append(mat)


def build_all_materials():
    return {name: make_flat_material(name, hex_color)
            for name, hex_color in PALETTE.items()}
