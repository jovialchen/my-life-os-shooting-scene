/**
 * 装饰工厂：地毯 / 装饰画
 *
 * 装饰特征：
 *   - 地毯：noCollision，shift 抓取
 *   - 装饰画：crossWall，可跨墙拖拽
 */
import * as THREE from 'three';
import { matRug, matFrame } from '../materials.js';

// ── 地毯默认尺寸 ──────────────────────────────────────
const RUG_DEFAULTS = {
    width: 3.5,
    depth: 2.8,
    yOffset: 0.005,
};

// ── 装饰画默认尺寸 ────────────────────────────────────
const ART = {
    frameWidth: 0.9,
    frameHeight: 0.65,
    frameDepth: 0.04,
    canvasWidth: 0.78,
    canvasHeight: 0.53,
    canvasColor: 0xc2956b,
    canvasRoughness: 0.85,
    canvasZOffset: 0.025,
    blockColors: [0xdaa520, 0xcd853f, 0xa0522d, 0xf4a460],
    blockWidth: 0.35,
    blockHeight: 0.22,
    blockRoughness: 0.9,
    blockSpacingX: 0.36,
    blockOffsetY: 0.13,
    blockZOffset: 0.026,
};


/**
 * 创建地毯
 * @param {object} opts
 * @param {number} [opts.width=3.5]
 * @param {number} [opts.depth=2.8]
 * @param {{x,y,z}} [opts.position]
 * @returns {THREE.Group}
 */
export function createRug({ width, depth, position } = {}) {
    const w = width || RUG_DEFAULTS.width;
    const d = depth || RUG_DEFAULTS.depth;

    const rug = new THREE.Mesh(new THREE.PlaneGeometry(w, d), matRug);
    rug.rotation.x = -Math.PI / 2;
    rug.position.y = RUG_DEFAULTS.yOffset;
    rug.receiveShadow = true;
    rug.userData.noCollision = true;

    if (position) {
        rug.position.x = position.x || 0;
        rug.position.z = position.z || 0;
    }

    return rug;
}


/**
 * 创建装饰画
 * @param {object} opts
 * @param {{x,y,z}} [opts.position]
 * @param {number}  [opts.rotation] — Y 轴旋转
 * @returns {THREE.Group}
 */
export function createWallArt({ position, rotation } = {}) {
    const art = new THREE.Group();

    // 画框
    const frame = new THREE.Mesh(
        new THREE.BoxGeometry(ART.frameWidth, ART.frameHeight, ART.frameDepth),
        matFrame,
    );
    frame.castShadow = true;
    art.add(frame);

    // 画布底色
    const canvas = new THREE.Mesh(
        new THREE.PlaneGeometry(ART.canvasWidth, ART.canvasHeight),
        new THREE.MeshStandardMaterial({ color: ART.canvasColor, roughness: ART.canvasRoughness }),
    );
    canvas.position.z = ART.canvasZOffset;
    art.add(canvas);

    // 四色装饰块
    ART.blockColors.forEach((c, i) => {
        const block = new THREE.Mesh(
            new THREE.PlaneGeometry(ART.blockWidth, ART.blockHeight),
            new THREE.MeshStandardMaterial({ color: c, roughness: ART.blockRoughness }),
        );
        block.position.set(
            (i % 2 - 0.5) * ART.blockSpacingX,
            i < 2 ? ART.blockOffsetY : -ART.blockOffsetY,
            ART.blockZOffset,
        );
        art.add(block);
    });

    if (position) art.position.set(position.x || 0, position.y || 2.0, position.z || 0);
    if (rotation != null) art.rotation.y = rotation;

    art.userData.crossWall = true;
    return art;
}
