/**
 * 四季系统
 *
 * 根据季节值（0~3）平滑更新：
 * - 草地颜色
 * - 树冠颜色 + 可见性
 * - 花卉可见性比例
 * - 季节物体（果子/蘑菇/雪人/雪团）可见性
 */
import * as THREE from 'three';
import { SEASON_PRESETS } from '../config.js';
import { matCanopy, matCanopyDark, matBlossom, matTrunk } from '../materials.js';

// ── 内部状态 ─────────────────────────────────────────
let grassMesh = null;
let gardenTreesGroup = null;
let gardenFlowersGroup = null;
let seasonalObjectsGroup = null;

// 季节物体子组引用
let fruitsGroup = null;
let mushroomsGroup = null;
let snowmanGroup = null;
let treeSnowGroup = null;

// 花卉总数
let totalFlowers = 0;

// ── 公共接口 ─────────────────────────────────────────

/**
 * 初始化季节系统
 * @param {THREE.Mesh} grass — 草地 mesh（可变材质）
 * @param {THREE.Group} trees — 花园树木 group
 * @param {THREE.Group} flowers — 花园花卉 group
 * @param {THREE.Group} seasonal — 季节物体 group
 */
export function initSeasons(grass, trees, flowers, seasonal) {
    grassMesh = grass;
    gardenTreesGroup = trees;
    gardenFlowersGroup = flowers;
    seasonalObjectsGroup = seasonal;

    // 获取季节物体子组引用
    if (seasonal) {
        fruitsGroup = seasonal.getObjectByName('fruits');
        mushroomsGroup = seasonal.getObjectByName('mushrooms');
        snowmanGroup = seasonal.getObjectByName('snowman');
        treeSnowGroup = seasonal.getObjectByName('treeSnow');
    }

    // 统计花卉总数
    if (flowers) {
        totalFlowers = flowers.children.length;
    }
}

/**
 * 更新季节状态
 * @param {number} value — 0=春, 1=夏, 2=秋, 3=冬，支持小数过渡
 */
export function updateSeason(value) {
    const idx = Math.min(Math.floor(value), SEASON_PRESETS.length - 2);
    const t = smoothstep(value - idx);
    const a = SEASON_PRESETS[idx];
    const b = SEASON_PRESETS[idx + 1];

    // ── 草地颜色 ──
    if (grassMesh) {
        const grassColor = lerpColor(a.grass, b.grass, t);
        grassMesh.material.color.set(grassColor);
    }

    // ── 树冠颜色 ──
    // 阔叶树冠：春嫩绿→夏深绿→秋橙红→冬隐藏
    const canopyA = a.canopy;
    const canopyB = b.canopy;
    if (canopyA !== null && canopyB !== null) {
        matCanopy.color.set(lerpColor(canopyA, canopyB, t));
    }

    // ── 树冠颜色 + 可见性（按树型分别处理）──
    if (gardenTreesGroup) {
        gardenTreesGroup.children.forEach(tree => {
            const type = tree.userData.treeType;
            const meshes = tree.userData.canopyMeshes || [];

            // 冬天（value >= 2.5）：落叶木和樱花树冠隐藏
            // 秋→冬过渡（2.0~2.5）：逐渐变透明
            const isWinter = value >= 2.5;
            const isFading = value >= 2.0 && value < 2.5;
            const fadeT = isFading ? (value - 2.0) * 2 : 0; // 0→1

            for (const mesh of meshes) {
                // 更新颜色
                if (type === 'deciduous') {
                    const c = (a.canopy !== null && b.canopy !== null)
                        ? lerpColor(a.canopy, b.canopy, t) : null;
                    if (c !== null) mesh.material.color.set(c);
                } else if (type === 'cherry') {
                    const c = (a.blossom !== null && b.blossom !== null)
                        ? lerpColor(a.blossom, b.blossom, t) : null;
                    if (c !== null) mesh.material.color.set(c);
                } else if (type === 'pine') {
                    mesh.material.color.set(lerpColor(a.canopyDark, b.canopyDark, t));
                }

                // 可见性：落叶木和樱花在冬天隐藏
                if (type === 'deciduous' || type === 'cherry') {
                    if (isWinter) {
                        mesh.visible = false;
                    } else if (isFading) {
                        mesh.visible = true;
                        if (!mesh.userData._seasonCloned) {
                            mesh.material = mesh.material.clone();
                            mesh.material.transparent = true;
                            mesh.userData._seasonCloned = true;
                        }
                        mesh.material.opacity = 1 - fadeT;
                    } else {
                        mesh.visible = true;
                        if (mesh.userData._seasonCloned) {
                            mesh.material.opacity = 1;
                        }
                    }
                }
            }
        });
    }

    // ── 花卉可见性 ──
    if (gardenFlowersGroup && totalFlowers > 0) {
        const ratio = lerp(a.flowerRatio, b.flowerRatio, t);
        const visibleCount = Math.round(totalFlowers * ratio);
        gardenFlowersGroup.children.forEach((flower, i) => {
            flower.visible = i < visibleCount;
        });
    }

    // ── 季节物体可见性 ──
    // 果子：秋（1.5~2.0），叶子开始凋落时果子就没了
    if (fruitsGroup) {
        fruitsGroup.visible = value >= 1.5 && value < 2.0;
    }
    // 蘑菇：秋（1.5~2.0）
    if (mushroomsGroup) {
        mushroomsGroup.visible = value >= 1.5 && value < 2.0;
    }
    // 雪人：冬（2.5~3.5）
    if (snowmanGroup) {
        snowmanGroup.visible = value >= 2.5;
    }
    // 树上雪团：冬（2.5~3.5）
    if (treeSnowGroup) {
        treeSnowGroup.visible = value >= 2.5;
    }
}


// ── 内部工具 ─────────────────────────────────────────

function smoothstep(t) {
    return t * t * (3 - 2 * t);
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

/** 在两个 hex 颜色之间插值 */
function lerpColor(c1, c2, t) {
    const r1 = (c1 >> 16) & 0xff, g1 = (c1 >> 8) & 0xff, b1 = c1 & 0xff;
    const r2 = (c2 >> 16) & 0xff, g2 = (c2 >> 8) & 0xff, b2 = c2 & 0xff;
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    return (r << 16) | (g << 8) | b;
}
