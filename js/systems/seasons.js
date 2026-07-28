/**
 * 四季系统
 *
 * 根据季节值（0~3）平滑更新：
 *   - 草地颜色（岛屿顶面 MAT_grass 材质）
 *   - 树叶颜色（season_leaves 标记的 mesh）
 *   - 树叶茂密度：秋→冬过渡时绕树干基点缩小到 0（落叶）
 */
import * as THREE from 'three';
import { SEASON_PRESETS } from '../config.js';

// ── 内部状态 ─────────────────────────────────────────
let grassMaterials = [];
let leaves = [];   // [{ mesh, anchor: THREE.Vector3|null }]

// ── 公共接口 ─────────────────────────────────────────

/**
 * 初始化季节系统（岛屿 GLB 加载完成后调用）
 * @param {{ grassMaterials?: Array<THREE.Material>, leaves?: Array<{mesh: THREE.Mesh, anchor: THREE.Vector3|null}> }} targets
 */
export function initSeasons({ grassMaterials: gm = [], leaves: lm = [] } = {}) {
    grassMaterials = gm;
    leaves = lm;
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

    for (const m of grassMaterials) {
        m.color.set(lerpColor(a.grass, b.grass, t));
    }

    if (leaves.length > 0) {
        const color = lerpColor(a.leaves, b.leaves, t);
        // 茂密度：秋(2)之前满叶，秋→冬缩小到 0
        const density = 1 - smoothstep(THREE.MathUtils.clamp(value - 2, 0, 1));
        for (const { mesh, anchor } of leaves) {
            mesh.material.color.set(color);
            mesh.visible = density > 0.01;
            const s = Math.max(density, 0.001);
            mesh.scale.setScalar(s);
            if (anchor) {
                // 顶点为世界坐标（原点不在树上），缩放须绕树干基点
                mesh.position.set(
                    anchor.x * (1 - s),
                    anchor.y * (1 - s),
                    anchor.z * (1 - s),
                );
            }
        }
    }
}

// ── 内部工具 ─────────────────────────────────────────

function smoothstep(t) {
    return t * t * (3 - 2 * t);
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
