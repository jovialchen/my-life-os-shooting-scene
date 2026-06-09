/**
 * 房间装饰：地毯 + 墙面装饰画
 */
import * as THREE from 'three';
import { ROOM_WIDTH } from '../config.js';
import { matRug, matFrame } from '../materials.js';

// ── 地毯尺寸 ──────────────────────────────────────────
const RUG = {
    width: 3.5,
    depth: 2.8,
    yOffset: 0.005, // 几乎贴地
    posZ: 0.5,
};

// ── 装饰画尺寸 ────────────────────────────────────────
const ART = {
    frameWidth: 0.9,
    frameHeight: 0.65,
    frameDepth: 0.04,
    canvasWidth: 0.78,
    canvasHeight: 0.53,
    canvasColor: 0xc2956b,   // 暖棕色画布底色
    canvasRoughness: 0.85,
    canvasZOffset: 0.025,
    // 四色装饰块
    blockColors: [0xdaa520, 0xcd853f, 0xa0522d, 0xf4a460], // 金、秘鲁棕、赭石、沙棕
    blockWidth: 0.35,
    blockHeight: 0.22,
    blockRoughness: 0.9,
    blockSpacingX: 0.36,     // x 间距
    blockOffsetY: 0.13,      // 上下排 y 偏移
    blockZOffset: 0.026,
    // 摆放位置（左墙）
    wallXOffset: 0.03,       // 离左墙距离
    posY: 2.0,
    posZ: -1.0,
};

// ── 地毯 ─────────────────────────────────────────────
export function createRug() {
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(RUG.width, RUG.depth), matRug);
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0, RUG.yOffset, RUG.posZ);
    rug.receiveShadow = true;
    return rug;
}

// ── 墙面装饰画（挂左墙） ─────────────────────────────
export function createWallArt() {
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

    // 挂到左墙
    art.position.set(-ROOM_WIDTH / 2 + ART.wallXOffset, ART.posY, ART.posZ);
    art.rotation.y = Math.PI / 2;
    return art;
}
