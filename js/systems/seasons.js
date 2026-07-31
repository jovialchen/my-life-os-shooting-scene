/**
 * 四季系统
 *
 * 根据季节值（0~3：0春 1夏 2秋 3冬，支持小数过渡）平滑更新：
 *   - 草地颜色（岛屿顶面 + 草丛共享的 MAT_grass 材质）
 *   - 落叶树：春=各自花色（粉/深粉/白）→ 夏绿 → 秋=各自叶色 → 冬落叶（缩放到 0）
 *   - 松树：常青，冬季略加深
 *   - 秋果：秋季窗口绕树干基点缩放显现（每树一种果色，材质在 Blender 烘焙）
 *   - 雪盖：冬季窗口绕树干基点缩放显现（落叶树枝尖/松树层上）
 *   - 雪人：冬季缩放显现（原点即底座，直接整体缩放）
 *   - 应季花卉：按各自花期窗口（flower_bloom_in/out）透明度淡入淡出
 *
 * 数据全部来自 island.glb 的 extras（tools/make_island.py 写入）。
 */
import * as THREE from 'three';
import { SEASON_PRESETS } from '../config.js';

// ── 内部状态 ─────────────────────────────────────────
let grassMaterials = [];
let trees = [];          // [{ leaves, type, spring, autumn, anchor, fruits, snow }]
let flowerGroups = [];   // [{ mesh, bloomIn, bloomOut }]
let snowman = null;

const SUMMER_LEAF = SEASON_PRESETS[1].leaves;   // 落叶树夏季统一绿
const PINE_SUMMER = 0x3a6b38;                   // 松树常青（偏深）
const PINE_WINTER = 0x2e5a30;                   // 冬季略加深
const FRUIT_WIN = [1.6, 2.0, 2.55, 2.95];       // 秋果窗口：淡入/保持/淡出
const SNOW_WIN = [2.55, 2.95];                  // 雪盖窗口：淡入
const SNOWMAN_WIN = [2.6, 2.95];                // 雪人窗口：淡入

// ── 公共接口 ─────────────────────────────────────────

/**
 * 初始化季节系统（岛屿 GLB 加载完成后调用）
 * @param {{ grassMaterials?: Array<THREE.Material>,
 *   trees?: Array, flowerGroups?: Array, snowman?: THREE.Mesh|null }} targets
 */
export function initSeasons({ grassMaterials: gm = [], trees: t = [],
                              flowerGroups: fg = [], snowman: sm = null } = {}) {
    grassMaterials = gm;
    trees = t;
    flowerGroups = fg;
    snowman = sm;
    // 花卉淡入淡出需要透明材质
    for (const g of flowerGroups) {
        for (const m of matsOf(g.mesh)) m.transparent = true;
    }
}

/**
 * 更新季节状态
 * @param {number} value — 0=春, 1=夏, 2=秋, 3=冬，支持小数过渡
 */
export function updateSeason(value) {
    const v = THREE.MathUtils.clamp(value, 0, 3);

    // ── 草地 ──
    const idx = Math.min(Math.floor(v), SEASON_PRESETS.length - 2);
    const t = smoothstep(v - idx);
    const a = SEASON_PRESETS[idx];
    const b = SEASON_PRESETS[idx + 1];
    for (const m of grassMaterials) {
        m.color.set(lerpColor(a.grass, b.grass, t));
    }

    // ── 树 ──
    const bare = smoothstep(THREE.MathUtils.clamp(v - 2, 0, 1));   // 秋→冬 0..1
    for (const tree of trees) {
        if (tree.type === 'pine') {
            // 常青：不落叶，冬季颜色略加深
            tree.leaves.material.color.set(lerpColor(PINE_SUMMER, PINE_WINTER, bare));
            tree.leaves.visible = true;
            setScaled(tree.leaves, tree.anchor, 1);
        } else {
            // 落叶树：花色 → 夏绿 → 秋叶色
            const c = v <= 1
                ? lerpColor(tree.spring, SUMMER_LEAF, smoothstep(v))
                : lerpColor(SUMMER_LEAF, tree.autumn, smoothstep(v - 1));
            tree.leaves.material.color.set(c);
            const density = 1 - bare;
            tree.leaves.visible = density > 0.01;
            setScaled(tree.leaves, tree.anchor, Math.max(density, 0.001));
        }
        // 秋果
        if (tree.fruits) {
            const w = window01(v, ...FRUIT_WIN);
            tree.fruits.visible = w > 0.01;
            setScaled(tree.fruits, tree.anchor, Math.max(w, 0.001));
        }
        // 雪盖
        if (tree.snow) {
            const w = smoothstep((v - SNOW_WIN[0]) / (SNOW_WIN[1] - SNOW_WIN[0]));
            tree.snow.visible = w > 0.01;
            setScaled(tree.snow, tree.anchor, Math.max(w, 0.001));
        }
    }

    // ── 雪人（原点在底座，直接整体缩放）──
    if (snowman) {
        const w = smoothstep((v - SNOWMAN_WIN[0])
                             / (SNOWMAN_WIN[1] - SNOWMAN_WIN[0]));
        snowman.visible = w > 0.01;
        snowman.scale.setScalar(Math.max(w, 0.001));
    }

    // ── 应季花卉（透明度淡入淡出）──
    for (const g of flowerGroups) {
        const w = window01(v, g.bloomIn - 0.3, g.bloomIn,
                           g.bloomOut, g.bloomOut + 0.3);
        g.mesh.visible = w > 0.02;
        for (const m of matsOf(g.mesh)) m.opacity = w;
    }
}

// ── 内部工具 ─────────────────────────────────────────

/** 绕锚点缩放（树叶/果子/雪盖顶点为世界坐标，原点不在树上） */
function setScaled(mesh, anchor, s) {
    mesh.scale.setScalar(s);
    if (anchor) {
        mesh.position.set(
            anchor.x * (1 - s),
            anchor.y * (1 - s),
            anchor.z * (1 - s),
        );
    }
}

/** 窗口函数：a→b 淡入，b→c 保持，c→d 淡出 */
function window01(v, a, b, c, d) {
    return smoothstep((v - a) / (b - a))
        * (1 - smoothstep((v - c) / (d - c)));
}

/** 收集对象（含 Group 子树）的所有材质——多材质 mesh 在 GLB 里是 Group+子 mesh */
function matsOf(obj) {
    const mats = [];
    const push = (m) => { if (m && !mats.includes(m)) mats.push(m); };
    if (typeof obj.traverse === 'function') {
        obj.traverse((c) => {
            if (!c.isMesh) return;
            for (const m of Array.isArray(c.material) ? c.material : [c.material]) push(m);
        });
    }
    if (mats.length === 0) {
        for (const m of Array.isArray(obj.material) ? obj.material : [obj.material]) push(m);
    }
    return mats;
}

function smoothstep(t) {
    t = THREE.MathUtils.clamp(t, 0, 1);
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
