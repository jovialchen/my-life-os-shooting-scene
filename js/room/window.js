/**
 * 窗户 + 窗帘 + 窗台小盆栽
 * 全部挂在右墙上，位置由 ROOM_WIDTH 自动推算
 */
import * as THREE from 'three';
import { ROOM_WIDTH, ROOM_HEIGHT } from '../config.js';
import { matFrame, matGlass, matMetal, matCurtain, matPot, matLeaf } from '../materials.js';

// ── 窗户尺寸（模块级共享） ─────────────────────────────
const WIN = {
    width: 5.0,          // 窗宽，两侧各留 1.0 墙面
    heightMargin: 0.5,   // 窗高 = ROOM_HEIGHT - 此值
    sillHeight: 0.25,    // 窗台高度
    frameWidth: 0.06,    // 边框宽度
    frameDepth: 0.04,    // 边框厚度（z方向）
    crossbarThick: 0.04, // 十字窗棂厚度
    glassZOffset: 0.01,  // 玻璃 z 偏移（避免 z-fighting）
    sillExtraWidth: 0.3, // 窗台超出窗宽的量
    sillThick: 0.06,     // 窗台厚度
    sillDepth: 0.2,      // 窗台深度
    sillZOffset: 0.08,   // 窗台 z 偏移
    wallXOffset: 0.02,   // 窗户组离墙边缘 x 偏移
};

// ── 窗帘尺寸 ──────────────────────────────────────────
const CURTAIN = {
    rodYOffset: 0.05,        // 杆 y 偏移（窗顶上方）
    rodLength: 6.0,          // 杆长：比窗宽各多 0.5
    rodRadius: 0.025,        // 杆半径
    rodSegments: 8,          // 杆径向分段
    capRadius: 0.04,         // 端头球半径
    capSegments: 8,          // 端头球分段
    panelSegments: 16,       // 窗帘网格分段（用于褶皱变形）
    zOffset: 0.15,           // 窗帘/杆 z 偏移（窗户前面）
    groupXOffset: 0.05,      // 窗帘组离墙边缘 x 偏移
};

// ── 盆栽尺寸 ──────────────────────────────────────────
const PLANT = {
    potTopRadius: 0.08,
    potBottomRadius: 0.06,
    potHeight: 0.12,
    potSegments: 12,
    potY: 0.06,
    leafCount: 5,
    leafBaseRadius: 0.06,
    leafRandomRadius: 0.04,
    leafSegments: 8,
    leafOrbitRadius: 0.06,
    leafBaseY: 0.16,
    leafRandomY: 0.08,
    // 摆放位置（相对窗户）
    offsetX: 0.1,   // 离 ROOM_WIDTH/2 的偏移
    posY: 0.28,
    posZ: 0.3,
};

// ── 窗台可放置表面 ────────────────────────────────────
export function computeSillSurface() {
    // 窗户组挂在右墙，rotation.y = -PI/2
    // 旋转后：本地 x → 世界 -z，本地 z → 世界 +x
    const groupX = ROOM_WIDTH / 2 - WIN.wallXOffset;
    const sillW = WIN.width + WIN.sillExtraWidth;
    return [{
        minX: groupX + WIN.sillZOffset - WIN.sillDepth / 2,
        maxX: groupX + WIN.sillZOffset + WIN.sillDepth / 2,
        minZ: -sillW / 2,
        maxZ: sillW / 2,
        height: WIN.sillHeight + WIN.sillThick / 2,
    }];
}

// ── 体积光雾锥 ────────────────────────────────────────
const CONE = {
    topRadius: 0.1,
    bottomRadius: 1.8,
    height: 3.5,
    segments: 16,
    color: 0xffddaa,
    opacity: 0.04,
    offsetX: 1.5,     // 离 ROOM_WIDTH/2 的偏移
    posY: 1.8,
    posZ: -0.5,
    rotExtra: 0.3,    // 在 PI/2 基础上的额外旋转
};

// ── 窗户（大窗，两侧留墙给窗帘收纳） ───────────────────
export function createWindow() {
    const win = new THREE.Group();
    const W = WIN.width;
    const H = ROOM_HEIGHT - WIN.heightMargin;
    const fw = WIN.frameWidth;
    const fd = WIN.frameDepth;
    const cy = WIN.sillHeight + H / 2; // 窗户中心 y

    // 四条边框（不是实心 Box，留出中间透光）
    const frameTop = new THREE.Mesh(new THREE.BoxGeometry(W + fw * 2, fw, fd), matFrame);
    frameTop.position.set(0, cy + H / 2 + fw / 2, 0);
    win.add(frameTop);

    const frameBot = new THREE.Mesh(new THREE.BoxGeometry(W + fw * 2, fw, fd), matFrame);
    frameBot.position.set(0, cy - H / 2 - fw / 2, 0);
    win.add(frameBot);

    const frameLeft = new THREE.Mesh(new THREE.BoxGeometry(fw, H, fd), matFrame);
    frameLeft.position.set(-W / 2 - fw / 2, cy, 0);
    win.add(frameLeft);

    const frameRight = new THREE.Mesh(new THREE.BoxGeometry(fw, H, fd), matFrame);
    frameRight.position.set(W / 2 + fw / 2, cy, 0);
    win.add(frameRight);

    // 玻璃（稍微朝房间方向偏移，避免 z-fighting）
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(W, H), matGlass);
    glass.position.set(0, cy, WIN.glassZOffset);
    win.add(glass);

    // 十字窗棂
    const barH = new THREE.Mesh(new THREE.BoxGeometry(W, WIN.crossbarThick, fd), matFrame);
    barH.position.y = cy;
    win.add(barH);
    const barV = new THREE.Mesh(new THREE.BoxGeometry(WIN.crossbarThick, H, fd), matFrame);
    barV.position.y = cy;
    win.add(barV);

    // 窗台
    const sill = new THREE.Mesh(
        new THREE.BoxGeometry(W + WIN.sillExtraWidth, WIN.sillThick, WIN.sillDepth),
        matFrame,
    );
    sill.position.set(0, WIN.sillHeight, WIN.sillZOffset);
    win.add(sill);

    // 挂到右墙（z 负方向 = 朝房间内侧）
    win.position.set(ROOM_WIDTH / 2 - WIN.wallXOffset, 0, 0);
    win.rotation.y = -Math.PI / 2;
    return win;
}

// ── 窗帘 ─────────────────────────────────────────────
export function createCurtains() {
    const group = new THREE.Group();

    const WIN_W = WIN.width;
    const H = ROOM_HEIGHT - WIN.heightMargin;
    const rodY = WIN.sillHeight + H + CURTAIN.rodYOffset;
    const ROD_LEN = CURTAIN.rodLength;
    const panelW = WIN_W / 2; // 每片宽度 = 半窗 = 2.5

    // 两片窗帘（高分段用于褶皱变形）
    [-1, 1].forEach(side => {
        const geo = new THREE.PlaneGeometry(panelW, H, CURTAIN.panelSegments, CURTAIN.panelSegments);
        const pos = geo.attributes.position;
        const origPositions = new Float32Array(pos.array.length);
        origPositions.set(pos.array);

        const curtain = new THREE.Mesh(geo, matCurtain);
        curtain.position.set(side * panelW / 2, WIN.sillHeight + H / 2, CURTAIN.zOffset);
        curtain.castShadow = true;
        curtain.userData.side = side;
        curtain.userData.origPositions = origPositions;
        group.add(curtain);
    });

    // 窗帘杆（也在窗户前面）
    const rod = new THREE.Mesh(
        new THREE.CylinderGeometry(CURTAIN.rodRadius, CURTAIN.rodRadius, ROD_LEN, CURTAIN.rodSegments),
        matMetal,
    );
    rod.rotation.z = Math.PI / 2;
    rod.position.set(0, rodY, CURTAIN.zOffset);
    group.add(rod);

    // 窗帘杆端头装饰
    [-1, 1].forEach(side => {
        const cap = new THREE.Mesh(
            new THREE.SphereGeometry(CURTAIN.capRadius, CURTAIN.capSegments, CURTAIN.capSegments),
            matMetal,
        );
        cap.position.set(side * ROD_LEN / 2, rodY, CURTAIN.zOffset);
        group.add(cap);
    });

    group.position.set(ROOM_WIDTH / 2 - CURTAIN.groupXOffset, 0, 0);
    group.rotation.y = -Math.PI / 2;
    return group;
}

// ── 窗台小盆栽 ───────────────────────────────────────
export function createPlant() {
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
    for (let i = 0; i < PLANT.leafCount; i++) {
        const leaf = new THREE.Mesh(
            new THREE.SphereGeometry(
                PLANT.leafBaseRadius + Math.random() * PLANT.leafRandomRadius,
                PLANT.leafSegments, PLANT.leafSegments,
            ),
            matLeaf,
        );
        const a = (i / PLANT.leafCount) * Math.PI * 2;
        leaf.position.set(
            Math.cos(a) * PLANT.leafOrbitRadius,
            PLANT.leafBaseY + Math.random() * PLANT.leafRandomY,
            Math.sin(a) * PLANT.leafOrbitRadius,
        );
        leaf.castShadow = true;
        plant.add(leaf);
    }

    plant.position.set(ROOM_WIDTH / 2 - PLANT.offsetX, PLANT.posY, PLANT.posZ);
    return plant;
}

// ── 体积光雾锥 ───────────────────────────────────────
export function createLightCone() {
    const geo = new THREE.CylinderGeometry(CONE.topRadius, CONE.bottomRadius, CONE.height, CONE.segments, 1, true);
    const mat = new THREE.MeshBasicMaterial({
        color: CONE.color,
        transparent: true,
        opacity: CONE.opacity,
        side: THREE.DoubleSide,
        depthWrite: false,
    });
    const cone = new THREE.Mesh(geo, mat);
    cone.position.set(ROOM_WIDTH / 2 - CONE.offsetX, CONE.posY, CONE.posZ);
    cone.rotation.z = Math.PI / 2 + CONE.rotExtra;
    return cone;
}
