/**
 * 花卉工厂：8 种低多边形程序化花卉
 *
 * 月季、玫瑰、紫罗兰、鸢尾花、茉莉、向日葵、薰衣草、郁金香
 * 工厂只管"建"，不管"放"。位置由调用者决定。
 */
import * as THREE from 'three';
import {
    matStem, matLeaf, matFlowerCenter,
    matPetalPink, matPetalDeepPink, matPetalPurple, matPetalBlue, matPetalWhite,
    matPetalYellow, matPetalLavender, matPetalRed, matSunflowerCenter,
} from '../materials.js';

// ── 通用尺寸 ─────────────────────────────────────────
const STEM_RADIUS   = 0.03;
const STEM_SEGMENTS = 5;   // 低多边形
const LEAF_W        = 0.15;
const LEAF_H        = 0.06;
const LEAF_D        = 0.03;

// ── 工具 ─────────────────────────────────────────────

/** 创建花茎 */
function createStem(height) {
    const geo = new THREE.CylinderGeometry(STEM_RADIUS, STEM_RADIUS * 1.2, height, STEM_SEGMENTS);
    const mesh = new THREE.Mesh(geo, matStem);
    mesh.position.y = height / 2;
    mesh.castShadow = true;
    return mesh;
}

/** 创建叶子（薄 Box） */
function createLeaf(y, angle, scale = 1) {
    const geo = new THREE.BoxGeometry(LEAF_W * scale, LEAF_H, LEAF_D * scale);
    const mesh = new THREE.Mesh(geo, matLeaf);
    mesh.position.set(Math.cos(angle) * 0.08, y, Math.sin(angle) * 0.08);
    mesh.rotation.set(0.3, angle, 0.5);
    mesh.castShadow = true;
    return mesh;
}


// ============================================================
//  ① 月季（多层重叠花瓣，粉）
// ============================================================

/**
 * @param {object} [opts]
 * @param {THREE.Vector3} [opts.position]
 * @param {number} [opts.scale=1]
 * @returns {THREE.Group}
 */
export function createRose({ position, scale: s = 1 } = {}) {
    const g = new THREE.Group();
    const h = 0.6 * s;

    // 茎
    g.add(createStem(h));

    // 叶子（2-3 片）
    g.add(createLeaf(h * 0.3, 0, s));
    g.add(createLeaf(h * 0.5, Math.PI * 0.7, s));
    g.add(createLeaf(h * 0.4, Math.PI * 1.4, s * 0.8));

    // 花头：两层花瓣
    const flowerY = h + 0.02 * s;
    const center = new THREE.Mesh(
        new THREE.SphereGeometry(0.04 * s, 5, 4),
        matFlowerCenter,
    );
    center.position.y = flowerY;
    g.add(center);

    // 内层花瓣（6 片，较小，更直立）
    for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const petal = new THREE.Mesh(
            new THREE.ConeGeometry(0.06 * s, 0.1 * s, 4),
            matPetalPink,
        );
        petal.position.set(
            Math.cos(angle) * 0.05 * s,
            flowerY + 0.03 * s,
            Math.sin(angle) * 0.05 * s,
        );
        petal.rotation.x = -Math.sin(angle) * 0.6;
        petal.rotation.z = Math.cos(angle) * 0.6;
        petal.castShadow = true;
        g.add(petal);
    }

    // 外层花瓣（6 片，较大，更平展）
    for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 + Math.PI / 6;
        const petal = new THREE.Mesh(
            new THREE.ConeGeometry(0.08 * s, 0.12 * s, 4),
            matPetalPink,
        );
        petal.position.set(
            Math.cos(angle) * 0.09 * s,
            flowerY - 0.01 * s,
            Math.sin(angle) * 0.09 * s,
        );
        petal.rotation.x = -Math.sin(angle) * 0.9;
        petal.rotation.z = Math.cos(angle) * 0.9;
        petal.castShadow = true;
        g.add(petal);
    }

    if (position) g.position.copy(position);
    return g;
}


// ============================================================
//  ② 玫瑰（球形花苞，深粉）
// ============================================================

/**
 * @param {object} [opts]
 * @param {THREE.Vector3} [opts.position]
 * @param {number} [opts.scale=1]
 * @returns {THREE.Group}
 */
export function createChinaRose({ position, scale: s = 1 } = {}) {
    const g = new THREE.Group();
    const h = 0.5 * s;

    g.add(createStem(h));
    g.add(createLeaf(h * 0.35, 0.5, s));
    g.add(createLeaf(h * 0.25, Math.PI * 1.2, s * 0.9));

    const flowerY = h + 0.02 * s;

    // 花蕊
    const center = new THREE.Mesh(
        new THREE.SphereGeometry(0.03 * s, 5, 4),
        matFlowerCenter,
    );
    center.position.y = flowerY + 0.02 * s;
    g.add(center);

    // 内层小球花瓣（紧密包裹）
    for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2;
        const petal = new THREE.Mesh(
            new THREE.SphereGeometry(0.05 * s, 4, 3),
            matPetalDeepPink,
        );
        petal.position.set(
            Math.cos(angle) * 0.03 * s,
            flowerY + 0.01 * s,
            Math.sin(angle) * 0.03 * s,
        );
        petal.castShadow = true;
        g.add(petal);
    }

    // 外层大球花瓣（松散展开）
    for (let i = 0; i < 7; i++) {
        const angle = (i / 7) * Math.PI * 2;
        const petal = new THREE.Mesh(
            new THREE.SphereGeometry(0.06 * s, 4, 3),
            matPetalDeepPink,
        );
        petal.position.set(
            Math.cos(angle) * 0.08 * s,
            flowerY - 0.02 * s,
            Math.sin(angle) * 0.08 * s,
        );
        petal.castShadow = true;
        g.add(petal);
    }

    if (position) g.position.copy(position);
    return g;
}


// ============================================================
//  ③ 紫罗兰（矮小，5 瓣小花）
// ============================================================

/**
 * @param {object} [opts]
 * @param {THREE.Vector3} [opts.position]
 * @param {number} [opts.scale=1]
 * @returns {THREE.Group}
 */
export function createViolet({ position, scale: s = 1 } = {}) {
    const g = new THREE.Group();
    const h = 0.25 * s;

    // 短茎
    g.add(createStem(h));

    // 叶子（心形用两个倾斜 Box 拼）
    const leaf1 = new THREE.Mesh(
        new THREE.BoxGeometry(0.12 * s, 0.02 * s, 0.1 * s),
        matLeaf,
    );
    leaf1.position.set(0.04 * s, h * 0.3, 0);
    leaf1.rotation.set(0.2, 0, 0.4);
    leaf1.castShadow = true;
    g.add(leaf1);

    const leaf2 = new THREE.Mesh(
        new THREE.BoxGeometry(0.1 * s, 0.02 * s, 0.1 * s),
        matLeaf,
    );
    leaf2.position.set(-0.03 * s, h * 0.25, 0.03 * s);
    leaf2.rotation.set(0.3, 1, -0.3);
    leaf2.castShadow = true;
    g.add(leaf2);

    // 花头：5 瓣小花
    const flowerY = h + 0.01 * s;
    const center = new THREE.Mesh(
        new THREE.SphereGeometry(0.02 * s, 4, 3),
        matFlowerCenter,
    );
    center.position.y = flowerY;
    g.add(center);

    for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2;
        const petal = new THREE.Mesh(
            new THREE.SphereGeometry(0.04 * s, 4, 3),
            matPetalPurple,
        );
        petal.position.set(
            Math.cos(angle) * 0.04 * s,
            flowerY,
            Math.sin(angle) * 0.04 * s,
        );
        petal.scale.set(1.2, 0.6, 1);
        petal.castShadow = true;
        g.add(petal);
    }

    if (position) g.position.copy(position);
    return g;
}


// ============================================================
//  ④ 鸢尾花（3 垂瓣 + 3 旗瓣，蓝紫）
// ============================================================

/**
 * @param {object} [opts]
 * @param {THREE.Vector3} [opts.position]
 * @param {number} [opts.scale=1]
 * @returns {THREE.Group}
 */
export function createIris({ position, scale: s = 1 } = {}) {
    const g = new THREE.Group();
    const h = 0.55 * s;

    g.add(createStem(h));
    g.add(createLeaf(h * 0.3, 0.3, s));
    g.add(createLeaf(h * 0.2, Math.PI * 0.8, s));
    g.add(createLeaf(h * 0.4, Math.PI * 1.5, s * 0.7));

    const flowerY = h + 0.02 * s;

    // 花蕊（小柱）
    const center = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015 * s, 0.02 * s, 0.06 * s, 5),
        matFlowerCenter,
    );
    center.position.y = flowerY + 0.03 * s;
    g.add(center);

    // 旗瓣（3 片，向上直立，较大）
    for (let i = 0; i < 3; i++) {
        const angle = (i / 3) * Math.PI * 2;
        const petal = new THREE.Mesh(
            new THREE.ConeGeometry(0.06 * s, 0.16 * s, 4),
            matPetalBlue,
        );
        petal.position.set(
            Math.cos(angle) * 0.04 * s,
            flowerY + 0.08 * s,
            Math.sin(angle) * 0.04 * s,
        );
        // 稍微向外倾斜
        petal.rotation.x = -Math.sin(angle) * 0.2;
        petal.rotation.z = Math.cos(angle) * 0.2;
        petal.castShadow = true;
        g.add(petal);
    }

    // 垂瓣（3 片，向下垂落）
    for (let i = 0; i < 3; i++) {
        const angle = (i / 3) * Math.PI * 2 + Math.PI / 3;
        const petal = new THREE.Mesh(
            new THREE.ConeGeometry(0.05 * s, 0.12 * s, 4),
            matPetalBlue,
        );
        petal.position.set(
            Math.cos(angle) * 0.06 * s,
            flowerY - 0.04 * s,
            Math.sin(angle) * 0.06 * s,
        );
        // 向下翻转
        petal.rotation.x = -Math.sin(angle) * 1.2 + Math.PI;
        petal.rotation.z = Math.cos(angle) * 1.2;
        petal.castShadow = true;
        g.add(petal);
    }

    if (position) g.position.copy(position);
    return g;
}


// ============================================================
//  ⑤ 茉莉（白花，细长花瓣）
// ============================================================

/**
 * @param {object} [opts]
 * @param {THREE.Vector3} [opts.position]
 * @param {number} [opts.scale=1]
 * @returns {THREE.Group}
 */
export function createJasmine({ position, scale: s = 1 } = {}) {
    const g = new THREE.Group();
    const h = 0.4 * s;

    g.add(createStem(h));
    g.add(createLeaf(h * 0.3, 0.4, s));
    g.add(createLeaf(h * 0.5, Math.PI, s * 0.8));

    const flowerY = h + 0.01 * s;

    // 花蕊
    const center = new THREE.Mesh(
        new THREE.SphereGeometry(0.02 * s, 4, 3),
        matFlowerCenter,
    );
    center.position.y = flowerY + 0.01 * s;
    g.add(center);

    // 花瓣（6 片，细长锥形，向外展开）
    for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const petal = new THREE.Mesh(
            new THREE.ConeGeometry(0.03 * s, 0.12 * s, 4),
            matPetalWhite,
        );
        petal.position.set(
            Math.cos(angle) * 0.05 * s,
            flowerY + 0.02 * s,
            Math.sin(angle) * 0.05 * s,
        );
        // 向外倾斜
        petal.rotation.x = -Math.sin(angle) * 0.8;
        petal.rotation.z = Math.cos(angle) * 0.8;
        petal.castShadow = true;
        g.add(petal);
    }

    if (position) g.position.copy(position);
    return g;
}


// ============================================================
//  花园批量放置
// ============================================================

const FLOWER_FACTORS = [createRose, createChinaRose, createViolet, createIris, createJasmine, createSunflower, createLavender, createTulip];


// ============================================================
//  ⑥ 向日葵（高茎，棕色花心 + 黄色花瓣）
// ============================================================

/**
 * @param {object} [opts]
 * @param {THREE.Vector3} [opts.position]
 * @param {number} [opts.scale=1]
 * @returns {THREE.Group}
 */
export function createSunflower({ position, scale: s = 1 } = {}) {
    const g = new THREE.Group();
    const h = 0.8 * s;

    g.add(createStem(h));
    g.add(createLeaf(h * 0.3, 0.2, s * 1.2));
    g.add(createLeaf(h * 0.5, Math.PI * 0.8, s * 1.1));
    g.add(createLeaf(h * 0.4, Math.PI * 1.5, s));

    const flowerY = h + 0.03 * s;

    // 棕色花心（大圆盘）
    const center = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08 * s, 0.08 * s, 0.02 * s, 8),
        matSunflowerCenter,
    );
    center.position.y = flowerY;
    g.add(center);

    // 黄色花瓣（12 片，向外辐射）
    for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const petal = new THREE.Mesh(
            new THREE.BoxGeometry(0.04 * s, 0.01 * s, 0.1 * s),
            matPetalYellow,
        );
        petal.position.set(
            Math.cos(angle) * 0.1 * s,
            flowerY,
            Math.sin(angle) * 0.1 * s,
        );
        petal.rotation.y = -angle;
        petal.rotation.x = 0.3;
        petal.castShadow = true;
        g.add(petal);
    }

    if (position) g.position.copy(position);
    return g;
}


// ============================================================
//  ⑦ 薰衣草（矮穗状紫色花）
// ============================================================

/**
 * @param {object} [opts]
 * @param {THREE.Vector3} [opts.position]
 * @param {number} [opts.scale=1]
 * @returns {THREE.Group}
 */
export function createLavender({ position, scale: s = 1 } = {}) {
    const g = new THREE.Group();
    const h = 0.35 * s;

    // 细茎
    g.add(createStem(h));

    // 窄叶
    const leaf1 = new THREE.Mesh(
        new THREE.BoxGeometry(0.04 * s, 0.01 * s, 0.15 * s),
        matLeaf,
    );
    leaf1.position.set(0.03 * s, h * 0.25, 0);
    leaf1.rotation.set(0.3, 0, 0.5);
    leaf1.castShadow = true;
    g.add(leaf1);

    const leaf2 = new THREE.Mesh(
        new THREE.BoxGeometry(0.04 * s, 0.01 * s, 0.12 * s),
        matLeaf,
    );
    leaf2.position.set(-0.02 * s, h * 0.2, 0.02 * s);
    leaf2.rotation.set(0.2, 1, -0.4);
    leaf2.castShadow = true;
    g.add(leaf2);

    // 穗状花序（多个小球堆叠）
    const flowerY = h;
    for (let i = 0; i < 8; i++) {
        const bud = new THREE.Mesh(
            new THREE.SphereGeometry(0.02 * s, 4, 3),
            matPetalLavender,
        );
        bud.position.set(
            (Math.random() - 0.5) * 0.02 * s,
            flowerY + i * 0.02 * s,
            (Math.random() - 0.5) * 0.02 * s,
        );
        bud.castShadow = true;
        g.add(bud);
    }

    if (position) g.position.copy(position);
    return g;
}


// ============================================================
//  ⑧ 郁金香（杯状花，红/黄）
// ============================================================

/**
 * @param {object} [opts]
 * @param {THREE.Vector3} [opts.position]
 * @param {number} [opts.scale=1]
 * @returns {THREE.Group}
 */
export function createTulip({ position, scale: s = 1 } = {}) {
    const g = new THREE.Group();
    const h = 0.45 * s;

    g.add(createStem(h));
    g.add(createLeaf(h * 0.3, 0.3, s));
    g.add(createLeaf(h * 0.25, Math.PI * 1.1, s * 0.9));

    const flowerY = h + 0.01 * s;

    // 杯状花（6 片花瓣围成杯形）
    const petalMat = Math.random() > 0.5 ? matPetalRed : matPetalYellow;
    for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const petal = new THREE.Mesh(
            new THREE.ConeGeometry(0.04 * s, 0.12 * s, 4),
            petalMat,
        );
        petal.position.set(
            Math.cos(angle) * 0.03 * s,
            flowerY + 0.04 * s,
            Math.sin(angle) * 0.03 * s,
        );
        // 向内倾斜形成杯状
        petal.rotation.x = -Math.sin(angle) * 0.3;
        petal.rotation.z = Math.cos(angle) * 0.3;
        petal.castShadow = true;
        g.add(petal);
    }

    if (position) g.position.copy(position);
    return g;
}




/**
 * 在建筑外围草地上生成随机花卉簇
 * @param {object} grassInfo — { centerX, centerZ, radius }
 * @returns {THREE.Group}
 */
export function createGardenFlowers(grassInfo) {
    const garden = new THREE.Group();
    garden.name = 'gardenFlowers';

    // 建筑边界（外墙外表面）
    const bldgMinX = -16.5;
    const bldgMaxX =  16.5;
    const bldgMinZ = -4.0;
    const bldgMaxZ =  14.0;

    // 在建筑四周生成花簇（密集版，窗窗春意盎然）
    const clusters = [
        // ── 南侧（建筑前面，4 扇南窗望出去）──
        { cx: -10, cz: bldgMinZ - 1.5, count: 6, spread: 2.5 },
        { cx:   0, cz: bldgMinZ - 1.8, count: 5, spread: 2.0 },
        { cx:  10, cz: bldgMinZ - 1.3, count: 6, spread: 2.5 },
        // 南侧新增密集花带
        { cx:  -6, cz: bldgMinZ - 3.5, count: 7, spread: 3.0 },
        { cx:   4, cz: bldgMinZ - 4.0, count: 7, spread: 3.0 },
        { cx: -12, cz: bldgMinZ - 2.5, count: 5, spread: 2.0 },
        { cx:  12, cz: bldgMinZ - 2.5, count: 5, spread: 2.0 },

        // ── 北侧（建筑后面，4 扇北窗望出去）──
        { cx: -8,  cz: bldgMaxZ + 1.5, count: 5, spread: 2.0 },
        { cx:  8,  cz: bldgMaxZ + 1.5, count: 5, spread: 2.0 },
        // 北侧新增密集花带
        { cx: -4,  cz: bldgMaxZ + 3.0, count: 7, spread: 3.0 },
        { cx:  4,  cz: bldgMaxZ + 3.5, count: 7, spread: 3.0 },
        { cx: -12, cz: bldgMaxZ + 2.5, count: 5, spread: 2.0 },
        { cx:  12, cz: bldgMaxZ + 2.5, count: 5, spread: 2.0 },

        // ── 东侧（2 扇东窗望出去）──
        { cx: bldgMaxX + 1.5, cz: 3,  count: 4, spread: 2.0 },
        { cx: bldgMaxX + 1.5, cz: 8,  count: 4, spread: 1.5 },
        // 东侧新增
        { cx: bldgMaxX + 3.0, cz: 1,  count: 5, spread: 2.5 },
        { cx: bldgMaxX + 3.0, cz: 10, count: 5, spread: 2.5 },

        // ── 西侧（门口附近少放，2 扇西窗望出去）──
        { cx: bldgMinX - 1.5, cz: 2,  count: 3, spread: 1.5 },
        { cx: bldgMinX - 1.5, cz: 9,  count: 4, spread: 2.0 },
        // 西侧新增（门口对面多放）
        { cx: bldgMinX - 3.0, cz: 0,  count: 4, spread: 2.0 },
        { cx: bldgMinX - 3.0, cz: 10, count: 5, spread: 2.5 },

        // ── 树下花丛（大树根部点缀）──
        { cx:  -6, cz: -10, count: 4, spread: 1.5 },  // 南左樱花下
        { cx:   0, cz: -14, count: 5, spread: 2.0 },  // 南中大绿树下
        { cx:   8, cz: -11, count: 4, spread: 1.5 },  // 南右松树下
        { cx:  -8, cz:  19, count: 4, spread: 1.5 },  // 北左大绿树下
        { cx:   7, cz:  20, count: 4, spread: 1.5 },  // 北右樱花下
        { cx: -22, cz:   0, count: 3, spread: 1.2 },  // 西南松树下
        { cx: -21, cz:  10, count: 3, spread: 1.2 },  // 西北大绿树下
        { cx:  22, cz:   1, count: 3, spread: 1.2 },  // 东南大绿树下
        { cx:  21, cz:  10, count: 3, spread: 1.2 },  // 东北松树下

        // ── 草坪中央点缀 ──
        { cx:  -5, cz:   5, count: 4, spread: 2.0 },
        { cx:   5, cz:   5, count: 4, spread: 2.0 },
    ];

    let flowerIndex = 0;
    for (const cluster of clusters) {
        for (let i = 0; i < cluster.count; i++) {
            const factory = FLOWER_FACTORS[Math.floor(Math.random() * FLOWER_FACTORS.length)];
            const x = cluster.cx + (Math.random() - 0.5) * cluster.spread;
            const z = cluster.cz + (Math.random() - 0.5) * cluster.spread;
            const s = 0.7 + Math.random() * 0.6; // 随机缩放 0.7~1.3

            const flower = factory({
                position: new THREE.Vector3(x, 0, z),
                scale: s,
            });
            // 随机旋转
            flower.rotation.y = Math.random() * Math.PI * 2;
            flower.userData.flowerIndex = flowerIndex++;
            // 标记所有 mesh 为遮挡体（挡住视线时变半透明）
            flower.traverse(child => { if (child.isMesh) child.userData.isOccluder = true; });
            garden.add(flower);
        }
    }

    return garden;
}
