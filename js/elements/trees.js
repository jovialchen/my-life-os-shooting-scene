/**
 * 树木工厂：3 种低多边形程序化大树
 *
 * 圆冠阔叶树、樱花树、锥形松树
 * 工厂只管"建"，不管"放"。位置由调用者决定。
 */
import * as THREE from 'three';
import { matTrunk, matCanopy, matCanopyDark, matBlossom } from '../materials.js';

// ── 通用参数 ─────────────────────────────────────────
const TRUNK_SEGMENTS = 6;  // 低多边形

/**
 * 给树添加树杈（3 根，从树干顶端向不同方向斜上方伸展）
 * 用 pivot Group 做旋转支点，确保底端贴着树干顶端
 * @param {THREE.Group} g — 树的 group
 * @param {number} trunkH — 树干高度
 * @param {number} trunkR — 树干半径
 * @param {number} s — 缩放
 */
function addBranches(g, trunkH, trunkR, s) {
    const branchCount = 3;
    const branchR = trunkR * 0.35;

    for (let i = 0; i < branchCount; i++) {
        const angle = (i / branchCount) * Math.PI * 2 + Math.random() * 0.3;
        const branchLen = (0.6 + Math.random() * 0.4) * s;

        // 旋转支点放在树干顶端
        const pivot = new THREE.Group();
        pivot.position.set(0, trunkH, 0);

        // 树杈 mesh：底端在 pivot 原点（= 树干顶端），向上延伸
        const branch = new THREE.Mesh(
            new THREE.CylinderGeometry(branchR * 0.3, branchR, branchLen, 4),
            matTrunk,
        );
        branch.position.y = branchLen / 2; // 底端在 y=0（pivot 处）
        branch.castShadow = true;
        pivot.add(branch);

        // 先绕 Y 轴转到目标方向，再向外倾斜
        pivot.rotation.y = angle;
        pivot.rotation.z = 0.7 + Math.random() * 0.3; // 向外倾斜 40-60°

        g.add(pivot);
    }
}


// ============================================================
//  ① 圆冠阔叶树（绿球冠）
// ============================================================

/**
 * @param {object} [opts]
 * @param {THREE.Vector3} [opts.position]
 * @param {number} [opts.scale=1]
 * @returns {THREE.Group}
 */
export function createDeciduousTree({ position, scale: s = 1 } = {}) {
    const g = new THREE.Group();

    const trunkH = (2.5 + Math.random() * 1.5) * s;
    const trunkR = 0.15 * s;
    const canopyR = (1.5 + Math.random() * 0.8) * s;

    // 树干
    const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(trunkR * 0.7, trunkR, trunkH, TRUNK_SEGMENTS),
        matTrunk,
    );
    trunk.position.y = trunkH / 2;
    trunk.castShadow = true;
    g.add(trunk);

    // 树杈
    addBranches(g, trunkH, trunkR, s);

    // 树冠（球体，稍微压扁）
    const canopy = new THREE.Mesh(
        new THREE.SphereGeometry(canopyR, 8, 6),
        matCanopy,
    );
    canopy.position.y = trunkH + canopyR * 0.6;
    canopy.scale.set(1, 0.85, 1);
    canopy.castShadow = true;
    g.add(canopy);

    // 额外的小球冠（增加层次感）
    const canopy2 = new THREE.Mesh(
        new THREE.SphereGeometry(canopyR * 0.6, 6, 5),
        matCanopy,
    );
    canopy2.position.set(
        canopyR * 0.4,
        trunkH + canopyR * 0.3,
        canopyR * 0.3,
    );
    canopy2.castShadow = true;
    g.add(canopy2);

    g.userData.canopyMeshes = [canopy, canopy2];
    if (position) g.position.copy(position);
    return g;
}


// ============================================================
//  ② 樱花树（粉球冠）
// ============================================================

/**
 * @param {object} [opts]
 * @param {THREE.Vector3} [opts.position]
 * @param {number} [opts.scale=1]
 * @returns {THREE.Group}
 */
export function createCherryBlossom({ position, scale: s = 1 } = {}) {
    const g = new THREE.Group();

    const trunkH = (2.0 + Math.random() * 1.0) * s;
    const trunkR = 0.12 * s;
    const canopyR = (1.8 + Math.random() * 0.6) * s;

    // 树干（略弯曲感：用两段拼接）
    const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(trunkR * 0.6, trunkR, trunkH, TRUNK_SEGMENTS),
        matTrunk,
    );
    trunk.position.y = trunkH / 2;
    trunk.castShadow = true;
    g.add(trunk);

    // 树杈
    addBranches(g, trunkH, trunkR, s);

    // 樱花主冠
    const canopy = new THREE.Mesh(
        new THREE.SphereGeometry(canopyR, 8, 6),
        matBlossom,
    );
    canopy.position.y = trunkH + canopyR * 0.5;
    canopy.scale.set(1, 0.75, 1);
    canopy.castShadow = true;
    g.add(canopy);

    // 侧冠（自然伸展感）
    const side1 = new THREE.Mesh(
        new THREE.SphereGeometry(canopyR * 0.55, 6, 5),
        matBlossom,
    );
    side1.position.set(canopyR * 0.6, trunkH * 0.85, canopyR * 0.2);
    side1.castShadow = true;
    g.add(side1);

    const side2 = new THREE.Mesh(
        new THREE.SphereGeometry(canopyR * 0.45, 6, 5),
        matBlossom,
    );
    side2.position.set(-canopyR * 0.4, trunkH * 0.75, -canopyR * 0.4);
    side2.castShadow = true;
    g.add(side2);

    g.userData.canopyMeshes = [canopy, side1, side2];
    if (position) g.position.copy(position);
    return g;
}


// ============================================================
//  ③ 锥形松树（绿锥冠）
// ============================================================

/**
 * @param {object} [opts]
 * @param {THREE.Vector3} [opts.position]
 * @param {number} [opts.scale=1]
 * @returns {THREE.Group}
 */
export function createPineTree({ position, scale: s = 1 } = {}) {
    const g = new THREE.Group();

    const trunkH = (3.0 + Math.random() * 1.5) * s;
    const trunkR = 0.12 * s;

    // 树干
    const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(trunkR * 0.6, trunkR, trunkH, TRUNK_SEGMENTS),
        matTrunk,
    );
    trunk.position.y = trunkH / 2;
    trunk.castShadow = true;
    g.add(trunk);

    // 树杈
    addBranches(g, trunkH, trunkR, s);

    // 三层锥形树冠（从下到上递减）
    const canopyMeshes = [];
    const layers = [
        { r: 1.4, h: 2.0, y: trunkH * 0.5 },
        { r: 1.1, h: 1.8, y: trunkH * 0.7 },
        { r: 0.7, h: 1.5, y: trunkH * 0.88 },
    ];

    for (const layer of layers) {
        const cone = new THREE.Mesh(
            new THREE.ConeGeometry(layer.r * s, layer.h * s, 7),
            matCanopyDark,
        );
        cone.position.y = layer.y * s + (layer.h * s) / 2;
        cone.castShadow = true;
        canopyMeshes.push(cone);
        g.add(cone);
    }

    g.userData.canopyMeshes = canopyMeshes;
    if (position) g.position.copy(position);
    return g;
}


// ============================================================
//  花园树木批量放置
// ============================================================

const TREE_FACTORS = [createDeciduousTree, createCherryBlossom, createPineTree];

/** 树木位置列表（用于寻路障碍标记） */
export const TREE_POSITIONS = [
    { x:  -6, z: -10, r: 0.25 },
    { x:   0, z: -14, r: 0.3 },
    { x:   8, z: -11, r: 0.2 },
    { x:  -8, z:  19, r: 0.3 },
    { x:   7, z:  20, r: 0.25 },
    { x: -22, z:   0, r: 0.2 },
    { x: -21, z:  10, r: 0.25 },
    { x:  22, z:   1, r: 0.25 },
    { x:  21, z:  10, r: 0.2 },
    { x: -15, z: -15, r: 0.2 },
    { x:  15, z: -16, r: 0.25 },
    { x: -14, z:  21, r: 0.2 },
    { x:  14, z:  22, r: 0.2 },
];

/**
 * 在建筑外围草地上生成大树
 * 放置策略：围绕建筑四周，确保每扇窗户望出去都有树
 *
 * @param {object} grassInfo — { centerX, centerZ, radius }
 * @returns {THREE.Group}
 */
export function createGardenTrees(grassInfo) {
    const garden = new THREE.Group();
    garden.name = 'gardenTrees';

    // 建筑边界
    const bldgMinX = -16.5;
    const bldgMaxX =  16.5;
    const bldgMinZ = -4.0;
    const bldgMaxZ =  14.0;

    // 放置位置：围绕建筑，每扇窗户视野方向至少有 1-2 棵树
    const placements = [
        // ── 南侧（4 扇南窗 z=-3.5 望出去的方向）──
        { x:  -6, z: -10, factory: createCherryBlossom, type: 'cherry',   s: 1.1 },  // room-e, room-f 窗景
        { x:   0, z: -14, factory: createDeciduousTree, type: 'deciduous', s: 1.3 },  // room-f, room-g 窗景（正中大绿树）
        { x:   8, z: -11, factory: createPineTree,      type: 'pine',      s: 1.0 },  // room-g, room-h 窗景

        // ── 北侧（4 扇北窗 z=13.5 望出去的方向）──
        { x:  -8, z: 19,  factory: createDeciduousTree, type: 'deciduous', s: 1.2 },  // room-a, room-b 窗景
        { x:   7, z: 20,  factory: createCherryBlossom, type: 'cherry',    s: 1.0 },  // room-c, room-d 窗景

        // ── 西侧（2 扇西窗 x=-16 望出去的方向）──
        { x: -22, z:  0,  factory: createPineTree,      type: 'pine',      s: 1.1 },  // room-e 西窗
        { x: -21, z: 10,  factory: createDeciduousTree, type: 'deciduous', s: 1.0 },  // room-a 西窗

        // ── 东侧（2 扇东窗 x=16 望出去的方向）──
        { x:  22, z:  1,  factory: createDeciduousTree, type: 'deciduous', s: 1.1 },  // room-h 东窗
        { x:  21, z: 10,  factory: createPineTree,      type: 'pine',      s: 1.0 },  // room-d 东窗

        // ── 额外点缀（增加层次感）──
        { x: -15, z: -15, factory: createPineTree,      type: 'pine',      s: 0.9 },  // 西南角
        { x:  15, z: -16, factory: createDeciduousTree, type: 'deciduous', s: 0.9 },  // 东南角
        { x: -14, z: 21,  factory: createCherryBlossom, type: 'cherry',    s: 0.8 },  // 西北角
        { x:  14, z: 22,  factory: createPineTree,      type: 'pine',      s: 0.8 },  // 东北角
    ];

    for (const p of placements) {
        // 确保在草地圆内
        const dx = p.x - grassInfo.centerX;
        const dz = p.z - grassInfo.centerZ;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > grassInfo.radius - 3) continue; // 离边缘留 3m 余量

        // 确保不在建筑范围内
        if (p.x > bldgMinX - 1 && p.x < bldgMaxX + 1 &&
            p.z > bldgMinZ - 1 && p.z < bldgMaxZ + 1) continue;

        const tree = p.factory({
            position: new THREE.Vector3(p.x, 0, p.z),
            scale: p.s,
        });
        tree.rotation.y = Math.random() * Math.PI * 2;
        tree.userData.treeType = p.type;
        // 标记所有 mesh 为遮挡体（挡住视线时变半透明）
        tree.traverse(child => { if (child.isMesh) child.userData.isOccluder = true; });
        garden.add(tree);
    }

    return garden;
}
