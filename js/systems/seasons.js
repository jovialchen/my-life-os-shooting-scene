/**
 * 四季系统（简化版）
 *
 * 根据季节值（0~3）平滑更新草地颜色
 */
import { SEASON_PRESETS } from '../config.js';

// ── 内部状态 ─────────────────────────────────────────
let grassMesh = null;

// ── 公共接口 ─────────────────────────────────────────

/**
 * 初始化季节系统
 * @param {THREE.Mesh} grass — 草地 mesh
 */
export function initSeasons(grass) {
    grassMesh = grass;
}

/**
 * 更新季节状态 — 仅更新草地颜色
 * @param {number} value — 0=春, 1=夏, 2=秋, 3=冬，支持小数过渡
 */
export function updateSeason(value) {
    if (!grassMesh) return;

    const idx = Math.min(Math.floor(value), SEASON_PRESETS.length - 2);
    const t = smoothstep(value - idx);
    const a = SEASON_PRESETS[idx];
    const b = SEASON_PRESETS[idx + 1];

    grassMesh.material.color.set(lerpColor(a.grass, b.grass, t));
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
