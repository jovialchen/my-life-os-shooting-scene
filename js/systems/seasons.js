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

    // 松树冠颜色
    matCanopyDark.color.set(lerpColor(a.canopyDark, b.canopyDark, t));

    // 樱花色
    if (a.blossom !== null && b.blossom !== null) {
        matBlossom.color.set(lerpColor(a.blossom, b.blossom, t));
    }

    // ── 树冠可见性（冬天隐藏阔叶和樱花树冠）──
    if (gardenTreesGroup) {
        gardenTreesGroup.children.forEach(tree => {
            const type = tree.userData.treeType;
            if (type === 'deciduous' || type === 'cherry') {
                // 阔叶和樱花树：冬（value > 2.5）时隐藏树冠
                tree.traverse(child => {
                    if (child.isMesh && child.material !== matTrunk) {
                        // 非树干的 mesh（树冠部分）
                        if (value >= 2.5) {
                            child.visible = false;
                        } else if (value >= 2.0) {
                            // 过渡：逐渐变透明
                            child.visible = true;
                            if (!child.userData._seasonCloned) {
                                child.material = child.material.clone();
                                child.material.transparent = true;
                                child.userData._seasonCloned = true;
                            }
                            child.material.opacity = 1 - (value - 2.0) * 2; // 2.0→2.5 从1到0
                        } else {
                            child.visible = true;
                            if (child.userData._seasonCloned) {
                                child.material.opacity = 1;
                            }
                        }
                    }
                });
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
    // 果子：秋（1.5~2.5）
    if (fruitsGroup) {
        fruitsGroup.visible = value >= 1.5 && value < 2.5;
    }
    // 蘑菇：秋（1.5~2.5）
    if (mushroomsGroup) {
        mushroomsGroup.visible = value >= 1.5 && value < 2.5;
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
