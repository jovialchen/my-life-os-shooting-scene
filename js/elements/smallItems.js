/**
 * 小物品工厂：盆栽 / 抱枕 / 书本
 *
 * 行为属性（movableType、rotationConstraint）由 categories.js 统一管理，
 * 工厂只负责构建几何体。
 */
import * as THREE from 'three';
import { matPot, matLeaf, matCushion, matFabricA, matBook1, matBook2, matBook3 } from '../materials.js';

// ── 盆栽默认尺寸 ──────────────────────────────────────
const PLANT = {
    potTopRadius: 0.08,
    potBottomRadius: 0.06,
    potHeight: 0.12,
    potSegments: 12,
    potY: 0.06,
    leafBaseRadius: 0.06,
    leafRandomRadius: 0.04,
    leafSegments: 8,
    leafOrbitRadius: 0.06,
    leafBaseY: 0.16,
    leafRandomY: 0.08,
};

// ── 抱枕默认尺寸 ──────────────────────────────────────
const CUSHION = {
    size: 0.4,
    depth: 0.15,
};

// ── 书本默认尺寸 ──────────────────────────────────────
const BOOK_DEFAULTS = {
    width: 0.15,    // 第二长边
    height: 0.06,   // 最短边
    depth: 0.2,     // 最长边
};

const BOOK_MATERIALS = [matBook1, matBook2, matBook3];


/**
 * 创建盆栽
 * @param {object} opts
 * @param {{x,y,z}} [opts.position] — 位置
 * @param {number}  [opts.leafCount=5] — 叶子数量
 * @returns {THREE.Group}
 */
export function createPlant({ position, leafCount = 5 } = {}) {
    const plant = new THREE.Group();

    // 花盆
    const pot = new THREE.Mesh(
        new THREE.CylinderGeometry(PLANT.potTopRadius, PLANT.potBottomRadius, PLANT.potHeight, PLANT.potSegments),
        matPot,
    );
    pot.position.y = PLANT.potY;
    pot.castShadow = true;
    plant.add(pot);

    // 叶子
    for (let i = 0; i < leafCount; i++) {
        const leaf = new THREE.Mesh(
            new THREE.SphereGeometry(
                PLANT.leafBaseRadius + Math.random() * PLANT.leafRandomRadius,
                PLANT.leafSegments, PLANT.leafSegments,
            ),
            matLeaf,
        );
        const a = (i / leafCount) * Math.PI * 2;
        leaf.position.set(
            Math.cos(a) * PLANT.leafOrbitRadius,
            PLANT.leafBaseY + Math.random() * PLANT.leafRandomY,
            Math.sin(a) * PLANT.leafOrbitRadius,
        );
        leaf.castShadow = true;
        plant.add(leaf);
    }

    if (position) plant.position.set(position.x, position.y, position.z);
    return plant;
}


/**
 * 创建抱枕
 * @param {object} opts
 * @param {{x,y,z}} [opts.position] — 位置
 * @param {number}  [opts.rotation] — Y 轴旋转
 * @param {THREE.Material} [opts.material] — 材质（默认 matCushion）
 * @returns {THREE.Group}
 */
export function createCushion({ position, rotation, material } = {}) {
    const cushion = new THREE.Group();

    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(CUSHION.size, CUSHION.size, CUSHION.depth),
        material || matCushion,
    );
    mesh.castShadow = true;
    cushion.add(mesh);

    if (position) cushion.position.set(position.x, position.y, position.z);
    if (rotation != null) cushion.rotation.z = rotation;
    return cushion;
}


/**
 * 创建书本
 * @param {object} opts
 * @param {{x,y,z}}       [opts.position] — 位置
 * @param {number}        [opts.rotation] — Y 轴旋转
 * @param {number}        [opts.rotationX] — X 轴旋转
 * @param {string}        [opts.state='standing'] — 'standing' | 'laying'
 * @param {number}        [opts.width]   — 第二长边（默认 0.15）
 * @param {number}        [opts.height]  — 最短边（默认 0.06）
 * @param {number}        [opts.depth]   — 最长边（默认 0.2）
 * @param {THREE.Material}[opts.material] — 材质（默认随机）
 * @returns {THREE.Group}
 */
export function createBook({ position, rotation, rotationX, state = 'standing', width, height, depth, material } = {}) {
    const w = width || BOOK_DEFAULTS.width;
    const h = height || BOOK_DEFAULTS.height;
    const d = depth || BOOK_DEFAULTS.depth;
    const mat = material || BOOK_MATERIALS[Math.floor(Math.random() * 3)];

    const book = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.castShadow = true;
    book.add(mesh);

    if (position) book.position.set(position.x, position.y, position.z);

    // 状态：standing = rotation.x=0, laying = rotation.x=PI/2
    if (state === 'laying') {
        book.rotation.x = Math.PI / 2;
    }
    if (rotationX != null) {
        book.rotation.x = rotationX;
    }
    if (rotation != null) {
        book.rotation.y = rotation;
    }

    return book;
}
