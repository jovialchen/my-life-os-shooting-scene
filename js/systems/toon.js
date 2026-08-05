/**
 * 三渲二（NPR）系统：MeshToonMaterial 转换 + 色阶贴图
 *
 * 方案见 doc/npr-pipeline.md：
 *   - 环境模型（房子/岛屿）的 Standard 材质替换成 MeshToonMaterial，
 *     色阶切分由程序化 gradientMap 控制（默认 3 阶：亮/中/暗）
 *   - 角色 VRM 自带 MToon（三渲二专用材质），不在此处理
 *   - 材质 name 保留（季节系统靠 MAT_grass 等名字找材质）
 */
import * as THREE from 'three';

let _gradientMap = null;

/**
 * 程序化色阶贴图（N×1 像素，NearestFilter 硬切）
 * @param {number} steps - 色阶级数（2=亮/暗硬切，3=亮/中/暗）
 */
export function createToonGradient(steps = 3) {
    const data = new Uint8Array(steps);
    for (let i = 0; i < steps; i++) {
        // 0 最暗 ~ 255 最亮；暗部压低拉开明暗对比（手绘风硬切色阶）
        data[i] = Math.round(112 + (143 * i) / (steps - 1));
    }
    const tex = new THREE.DataTexture(data, steps, 1, THREE.RedFormat);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    return tex;
}

function getGradientMap() {
    if (!_gradientMap) _gradientMap = createToonGradient(3);
    return _gradientMap;
}

/**
 * 把单个材质转成 MeshToonMaterial（保留颜色/贴图/透明/自发光/名字）
 * 已经是 toon / ShaderMaterial（MToon）/ Basic 的跳过
 */
export function toToonMaterial(material) {
    if (!material) return material;
    if (material.isMeshToonMaterial || material.isShaderMaterial || material.isMeshBasicMaterial) {
        return material;
    }
    const toon = new THREE.MeshToonMaterial({
        name: material.name,
        color: material.color?.clone() ?? new THREE.Color(0xffffff),
        map: material.map ?? null,
        gradientMap: getGradientMap(),
        side: material.side ?? THREE.FrontSide,
        transparent: material.transparent ?? false,
        opacity: material.opacity ?? 1,
        alphaTest: material.alphaTest ?? 0,
    });
    if (material.emissive) {
        toon.emissive.copy(material.emissive);
        toon.emissiveMap = material.emissiveMap ?? null;
        toon.emissiveIntensity = material.emissiveIntensity ?? 1;
    }
    toon.userData = { ...material.userData };
    return toon;
}

/**
 * 遍历 root 下所有 mesh，把材质替换成三渲二材质
 * @returns {number} 替换的材质数量
 */
export function applyToonShading(root) {
    let count = 0;
    root.traverse((child) => {
        if (!child.isMesh || !child.material) return;
        if (Array.isArray(child.material)) {
            child.material = child.material.map((m) => {
                const t = toToonMaterial(m);
                if (t !== m) count++;
                return t;
            });
        } else {
            const t = toToonMaterial(child.material);
            if (t !== child.material) {
                child.material = t;
                count++;
            }
        }
    });
    return count;
}
