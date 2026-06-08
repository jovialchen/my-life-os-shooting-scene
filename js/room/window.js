/**
 * 窗户 + 窗帘 + 窗台小盆栽
 * 全部挂在右墙上，位置由 ROOM_WIDTH 自动推算
 */
import * as THREE from 'three';
import { ROOM_WIDTH, ROOM_DEPTH, ROOM_HEIGHT } from '../config.js';
import { matFrame, matGlass, matMetal, matCurtain, matPot, matLeaf } from '../materials.js';

// ── 窗户（大窗，两侧留墙给窗帘收纳） ───────────────────
export function createWindow() {
    const win = new THREE.Group();
    const W = 5.0;                    // 窗宽，两侧各留 1.0 墙面
    const H = ROOM_HEIGHT - 0.5;      // 3.0
    const sillH = 0.25;
    const fw = 0.06;                  // 边框宽度
    const fd = 0.04;                  // 边框厚度（z方向）
    const cy = sillH + H / 2;         // 窗户中心 y

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
    glass.position.set(0, cy, 0.01);
    win.add(glass);

    // 十字窗棂
    const barH = new THREE.Mesh(new THREE.BoxGeometry(W, 0.04, fd), matFrame);
    barH.position.y = cy;
    win.add(barH);
    const barV = new THREE.Mesh(new THREE.BoxGeometry(0.04, H, fd), matFrame);
    barV.position.y = cy;
    win.add(barV);

    // 窗台
    const sill = new THREE.Mesh(new THREE.BoxGeometry(W + 0.3, 0.06, 0.2), matFrame);
    sill.position.set(0, sillH, 0.08);
    win.add(sill);

    // 挂到右墙（z 负方向 = 朝房间内侧）
    win.position.set(ROOM_WIDTH / 2 - 0.02, 0, 0);
    win.rotation.y = -Math.PI / 2;
    return win;
}

// ── 窗帘 ─────────────────────────────────────────────
export function createCurtains() {
    const group = new THREE.Group();

    const WIN_W = 5.0;               // 窗宽
    const H = ROOM_HEIGHT - 0.5;     // 窗高
    const sillH = 0.25;
    const rodY = sillH + H + 0.05;   // 杆在窗户顶端
    const ROD_LEN = 6.0;             // 杆宽：比窗宽各多 0.5（窗帘收纳空间）
    const panelW = WIN_W / 2;        // 每片宽度 = 半窗 = 2.5

    // 两片窗帘（高分段用于褶皱变形）
    // z = -0.15：在窗户前面（朝房间内侧）
    [-1, 1].forEach(side => {
        const geo = new THREE.PlaneGeometry(panelW, H, 16, 16);
        const pos = geo.attributes.position;
        const origPositions = new Float32Array(pos.array.length);
        origPositions.set(pos.array);

        const curtain = new THREE.Mesh(geo, matCurtain);
        curtain.position.set(side * panelW / 2, sillH + H / 2, 0.15);
        curtain.castShadow = true;
        curtain.userData.side = side;
        curtain.userData.origPositions = origPositions;
        group.add(curtain);
    });

    // 窗帘杆（也在窗户前面）
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, ROD_LEN, 8), matMetal);
    rod.rotation.z = Math.PI / 2;
    rod.position.set(0, rodY, 0.15);
    group.add(rod);

    // 窗帘杆端头装饰
    [-1, 1].forEach(side => {
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), matMetal);
        cap.position.set(side * ROD_LEN / 2, rodY, 0.15);
        group.add(cap);
    });

    group.position.set(ROOM_WIDTH / 2 - 0.05, 0, 0);
    group.rotation.y = -Math.PI / 2;
    return group;
}

// ── 窗台小盆栽 ───────────────────────────────────────
export function createPlant() {
    const plant = new THREE.Group();

    // 花盆
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.12, 12), matPot);
    pot.position.y = 0.06;
    pot.castShadow = true;
    plant.add(pot);

    // 叶子
    for (let i = 0; i < 5; i++) {
        const leaf = new THREE.Mesh(
            new THREE.SphereGeometry(0.06 + Math.random() * 0.04, 8, 8),
            matLeaf
        );
        const a = (i / 5) * Math.PI * 2;
        leaf.position.set(Math.cos(a) * 0.06, 0.16 + Math.random() * 0.08, Math.sin(a) * 0.06);
        leaf.castShadow = true;
        plant.add(leaf);
    }

    plant.position.set(ROOM_WIDTH / 2 - 0.1, 0.28, 0.3);
    return plant;
}

// ── 体积光雾锥 ───────────────────────────────────────
export function createLightCone() {
    const geo = new THREE.CylinderGeometry(0.1, 1.8, 3.5, 16, 1, true);
    const mat = new THREE.MeshBasicMaterial({
        color: 0xffddaa,
        transparent: true,
        opacity: 0.04,
        side: THREE.DoubleSide,
        depthWrite: false
    });
    const cone = new THREE.Mesh(geo, mat);
    cone.position.set(ROOM_WIDTH / 2 - 1.5, 1.8, -0.5);
    cone.rotation.z = Math.PI / 2 + 0.3;
    return cone;
}
