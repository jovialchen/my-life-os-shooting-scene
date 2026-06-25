/**
 * 墙壁工厂：三种墙类型 + 地板 + 天花板
 *
 * 三种墙：
 *   createSolidWall   — 实心墙
 *   createWindowWall  — 墙+窗+窗帘（强耦合）
 *   createDoorWall    — 墙+门+门框（强耦合）
 *
 * 每个工厂只管"建"，不管"放"。
 * 调用者通过 group.position / group.rotation 决定位置和朝向。
 */
import * as THREE from 'three';
import { matWall, matFloor, matCeiling, matFrame, matGlass, matMetal, matWood, matCurtain } from '../materials.js';

// ── 默认尺寸 ──────────────────────────────────────────
const WALL_T_DEFAULT = 0.12;

// ── 门框尺寸 ──────────────────────────────────────────
const FRAME_T = 0.06;
const FRAME_D = 0.08;

// ── 窗户默认尺寸 ──────────────────────────────────────
const WIN_FRAME_W = 0.06;
const WIN_FRAME_D = 0.04;
const WIN_CROSSBAR = 0.04;
const WIN_GLASS_Z = 0.01;
const WIN_SILL_EXTRA = 0.3;
const WIN_SILL_THICK = 0.06;
const WIN_SILL_DEPTH = 0.2;
const WIN_SILL_Z = 0.08;
const WIN_WALL_X_OFFSET = 0.02;

// ── 窗帘默认尺寸 ──────────────────────────────────────
const CURTAIN_ROD_Y_OFFSET = 0.05;
const CURTAIN_ROD_RADIUS = 0.025;
const CURTAIN_ROD_SEGMENTS = 8;
const CURTAIN_CAP_RADIUS = 0.04;
const CURTAIN_CAP_SEGMENTS = 8;
const CURTAIN_PANEL_SEGMENTS = 16;
const CURTAIN_Z_OFFSET = 0.15;
const CURTAIN_GROUP_X_OFFSET = 0.05;

// ── 门默认尺寸 ────────────────────────────────────────
const DOOR_PANEL_GAP = 0.05;
const DOOR_PANEL_HEIGHT_GAP = 0.03;
const DOOR_PANEL_THICK = 0.04;
const HANDLE_RADIUS = 0.02;
const HANDLE_LENGTH = 0.12;
const HANDLE_OFFSET_X = 0.08;


// ============================================================
//  ① 实心墙
// ============================================================

/**
 * @param {object} opts
 * @param {number} opts.width     — 墙宽（沿 x 轴）
 * @param {number} opts.height    — 墙高（沿 y 轴）
 * @param {number} [opts.thickness=0.12] — 墙厚（沿 z 轴）
 * @returns {THREE.Group}
 */
export function createSolidWall({ width, height, thickness = WALL_T_DEFAULT }) {
    const group = new THREE.Group();

    const wall = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, thickness),
        matWall,
    );
    wall.position.y = height / 2;
    wall.castShadow = true;
    wall.receiveShadow = true;
    group.add(wall);

    group.userData.wallType = 'solid';
    group.userData.wallSize = { width, height, thickness };
    group.userData.isWall = true;
    return group;
}


// ============================================================
//  ② 窗户墙：墙 + 窗 + 窗帘（强耦合）
// ============================================================

/**
 * @param {object} opts
 * @param {number} opts.width     — 墙宽
 * @param {number} opts.height    — 墙高
 * @param {number} [opts.thickness=0.12]
 * @param {object} opts.window
 * @param {number} opts.window.width       — 窗宽
 * @param {number} opts.window.sillHeight  — 窗台离地高度
 * @param {number} opts.window.topHeight   — 窗顶离地高度
 * @param {number} [opts.window.offset=0]  — 窗户水平偏移（0=居中）
 * @param {object} [opts.curtain]           — 不传则不生成窗帘
 * @param {number} [opts.curtain.rodLength] — 窗帘杆长度（默认 = 窗宽 + 1.0）
 * @returns {THREE.Group}
 */
export function createWindowWall({ width, height, thickness = WALL_T_DEFAULT, window: winCfg, curtain: curtainCfg }) {
    const group = new THREE.Group();

    const W = winCfg.width;
    const sill = winCfg.sillHeight;
    const top = winCfg.topHeight;
    const offX = winCfg.offset || 0;

    // 墙体：四块拼出窗洞（相对 group 原点，窗洞居中 + offX）
    const halfW = width / 2;
    const sideW = (width - W) / 2;               // 窗两侧墙宽
    const topH = height - top;                    // 窗上方墙高
    const botH = sill;                            // 窗下方墙高

    const addWallPiece = (w, h, x, y) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, thickness), matWall);
        m.position.set(x, y, 0);
        m.castShadow = true;
        m.receiveShadow = true;
        group.add(m);
    };

    // 左侧墙
    addWallPiece(sideW, height, -halfW + sideW / 2, height / 2);
    // 右侧墙
    addWallPiece(sideW, height, halfW - sideW / 2, height / 2);
    // 窗上方
    addWallPiece(W, topH, offX, top + topH / 2);
    // 窗下方
    addWallPiece(W, botH, offX, botH / 2);

    // 窗户（框 + 玻璃 + 窗棂 + 窗台）
    const winGroup = createWindowGeometry(W, sill, top, offX);
    winGroup.position.z = -thickness / 2 + WIN_WALL_X_OFFSET;
    group.add(winGroup);

    // 窗帘（可选）
    if (curtainCfg) {
        const rodLength = curtainCfg.rodLength || (W + 1.0);
        const curtainGroup = createCurtainGeometry(W, sill, top, rodLength);
        curtainGroup.position.z = -thickness / 2 + CURTAIN_GROUP_X_OFFSET;
        group.add(curtainGroup);
        group.userData.curtains = curtainGroup;
    }

    group.userData.wallType = 'window';
    group.userData.wallSize = { width, height, thickness };
    group.userData.window = winGroup;
    group.userData.isWall = true;
    return group;
}


// ============================================================
//  ③ 门墙：墙 + 门 + 门框（强耦合）
// ============================================================

/**
 * @param {object} opts
 * @param {number} opts.width
 * @param {number} opts.height
 * @param {number} [opts.thickness=0.12]
 * @param {object} opts.door
 * @param {number} opts.door.width             — 门宽
 * @param {number} opts.door.height            — 门高
 * @param {number} [opts.door.offset=0]        — 门水平偏移（0=居中）
 * @param {string} [opts.door.openDirection='left'] — 'left' | 'right'
 * @returns {THREE.Group}
 */
export function createDoorWall({ width, height, thickness = WALL_T_DEFAULT, door: doorCfg }) {
    const group = new THREE.Group();

    const DW = doorCfg.width;
    const DH = doorCfg.height;
    const offX = doorCfg.offset || 0;

    const halfW = width / 2;
    const sideW = (width - DW) / 2;
    const topH = height - DH;

    const addWallPiece = (w, h, x, y) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, thickness), matWall);
        m.position.set(x, y, 0);
        m.castShadow = true;
        m.receiveShadow = true;
        group.add(m);
    };

    // 左侧墙
    addWallPiece(sideW, height, -halfW + sideW / 2, height / 2);
    // 右侧墙
    addWallPiece(sideW, height, halfW - sideW / 2, height / 2);
    // 门上方
    addWallPiece(DW, topH, offX, DH + topH / 2);

    // 门（框 + 板 + 把手）
    const doorGroup = createDoorGeometry(DW, DH, doorCfg.openDirection);
    doorGroup.position.set(offX, 0, thickness / 2 - 0.01);
    group.add(doorGroup);

    group.userData.wallType = 'door';
    group.userData.wallSize = { width, height, thickness };
    group.userData.doorPivot = doorGroup.userData.doorPivot;
    group.userData.isOpen = false;
    group.userData.targetRotation = 0;
    group.userData.isWall = true;
    return group;
}


/**
 * ④ 门窗墙：一面墙上同时有门 + 窗
 *
 * 门和窗可以任意排列（左门右窗 / 左窗右门 等），通过各自的 offset 控制位置。
 *
 * @param {object} opts
 * @param {number} opts.width
 * @param {number} opts.height
 * @param {number} [opts.thickness=0.12]
 * @param {object} opts.door
 * @param {number} opts.door.width             — 门宽
 * @param {number} opts.door.height            — 门高
 * @param {number} [opts.door.offset]          — 门水平偏移（0=居中）
 * @param {string} [opts.door.openDirection='left']
 * @param {object} opts.window
 * @param {number} opts.window.width            — 窗宽
 * @param {number} opts.window.sillHeight       — 窗台离地高度
 * @param {number} opts.window.topHeight        — 窗顶离地高度
 * @param {number} [opts.window.offset]         — 窗水平偏移（0=居中）
 * @param {object} [opts.curtain]
 * @param {number} [opts.curtain.rodLength]
 * @returns {THREE.Group}
 */
export function createDoorWindowWall({ width, height, thickness = WALL_T_DEFAULT, door: doorCfg, window: winCfg, curtain: curtainCfg }) {
    const group = new THREE.Group();

    const DW = doorCfg.width;
    const DH = doorCfg.height;
    const dOff = doorCfg.offset || 0;

    const WW = winCfg.width;
    const WSill = winCfg.sillHeight;
    const WTop = winCfg.topHeight;
    const wOff = winCfg.offset || 0;
    const WH = WTop - WSill;

    const halfW = width / 2;

    // 门和窗的水平范围
    const dLeft = dOff - DW / 2;
    const dRight = dOff + DW / 2;
    const wLeft = wOff - WW / 2;
    const wRight = wOff + WW / 2;

    // 判断门和窗哪个在左
    const doorIsLeft = dOff < wOff;

    const addWallPiece = (w, h, x, y) => {
        if (w <= 0.001 || h <= 0.001) return;
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, thickness), matWall);
        m.position.set(x, y, 0);
        m.castShadow = true;
        m.receiveShadow = true;
        group.add(m);
    };

    // ── 垂直方向分区 ──
    // 下段（0 ~ min(WSill, DH)）
    const botY = Math.min(WSill, DH);
    if (botY > 0.001) {
        // 门区域：门下无墙体 → 跳过门宽范围
        // 窗区域：窗下有墙 → 填实
        if (doorIsLeft) {
            addWallPiece(dLeft - (-halfW), botY, (-halfW + dLeft) / 2, botY / 2);                       // 最左
            addWallPiece(dRight - dLeft, botY, (dLeft + dRight) / 2, botY / 2);                           // 门下无墙 → 已处理为开孔
            // Actually 门下范围是空的，不需要墙
            // 门和窗之间
            const midLeft = dRight;
            const midRight = wLeft;
            if (WSill < DH) {
                // 窗台低于门高：这段是窗下墙，要填
                addWallPiece(midRight - midLeft, WSill, (midLeft + midRight) / 2, WSill / 2);
            } else {
                // 窗台高于门高：这段部分有墙
                addWallPiece(midRight - midLeft, DH, (midLeft + midRight) / 2, DH / 2);
            }
            // 窗区（窗台以下部分）
            addWallPiece(wRight - wLeft, WSill, (wLeft + wRight) / 2, WSill / 2);
            // 最右
            addWallPiece(halfW - wRight, botY, (wRight + halfW) / 2, botY / 2);
        } else {
            addWallPiece(wLeft - (-halfW), botY, (-halfW + wLeft) / 2, botY / 2);
            addWallPiece(wRight - wLeft, WSill, (wLeft + wRight) / 2, WSill / 2);
            const midLeft = wRight;
            const midRight = dLeft;
            addWallPiece(midRight - midLeft, botY, (midLeft + midRight) / 2, botY / 2);
            addWallPiece(dRight - dLeft, botY, (dLeft + dRight) / 2, botY / 2);  // 门下空 → later correction
            addWallPiece(halfW - dRight, botY, (dRight + halfW) / 2, botY / 2);
        }
    }

    // ── 简单版：用矩形减法 ──
    // 实际上逐段处理太复杂。让我用更简洁的方式：
    // 把整面墙当作实心，然后在门和窗的位置"挖洞"。
    // 但 Three.js 不支持 CSG，所以还是用分块拼。

    // 清除之前的下段分块，改用更清晰的算法
    group.clear();

    /**
     * 墙壁分块策略：
     *
     * 水平分成最多 3 列：左列 | 中列 | 右列
     * 门和窗各占据一列。
     *
     * 如果 doorIsLeft: 左列=门, 右列=窗
     * 否则:            左列=窗, 右列=门
     *
     * 每列在垂直方向再分成：
     *   - 上段（开口上方）
     *   - 开口段（门洞/窗洞 — 门洞全空，窗洞装玻璃）
     *   - 下段（开口下方，窗户有窗下墙，门无）
     */

    // 左/中/右 分界点
    let leftCol, midCol, rightCol;  // {left, right, type}
    if (doorIsLeft) {
        leftCol  = { left: -halfW, right: dRight, type: 'door' };
        midCol   = { left: dRight, right: wLeft, type: 'solid' };
        rightCol = { left: wLeft, right: halfW, type: 'window' };
    } else {
        leftCol  = { left: -halfW, right: wRight, type: 'window' };
        midCol   = { left: wRight, right: dLeft, type: 'solid' };
        rightCol = { left: dLeft, right: halfW, type: 'door' };
    }

    // 对每列生成墙壁分块
    for (const col of [leftCol, midCol, rightCol]) {
        const colW = col.right - col.left;
        const colCX = (col.left + col.right) / 2;

        if (colW <= 0.001) continue;

        if (col.type === 'solid') {
            // 实心列：完整墙高
            addWallPiece(colW, height, colCX, height / 2);
        } else if (col.type === 'door') {
            // 门列：门上方 + 门洞
            addWallPiece(colW, height - DH, colCX, DH + (height - DH) / 2);  // 上方
            // 门下无墙（门洞）
        } else if (col.type === 'window') {
            // 窗列：窗上方 + 窗洞 + 窗下方
            addWallPiece(colW, height - WTop, colCX, WTop + (height - WTop) / 2);  // 上方
            addWallPiece(colW, WSill, colCX, WSill / 2);                            // 下方
            // 窗洞不填墙
        }
    }

    // ── 门几何体 ──
    const doorGroup = createDoorGeometry(DW, DH, doorCfg.openDirection || 'left');
    doorGroup.position.set(dOff, 0, thickness / 2 - 0.01);
    group.add(doorGroup);
    group.userData.doorPivot = doorGroup.userData.doorPivot;
    group.userData.isOpen = false;
    group.userData.targetRotation = 0;

    // ── 窗几何体 ──
    const winGroup = createWindowGeometry(WW, WSill, WTop, wOff);
    winGroup.position.z = -thickness / 2 + WIN_WALL_X_OFFSET;
    group.add(winGroup);
    group.userData.window = winGroup;

    // ── 窗帘（可选）──
    if (curtainCfg) {
        const rodLength = curtainCfg.rodLength || (WW + 1.0);
        const curtainGroup = createCurtainGeometry(WW, WSill, WTop, rodLength);
        curtainGroup.position.z = -thickness / 2 + CURTAIN_GROUP_X_OFFSET;
        group.add(curtainGroup);
        group.userData.curtains = curtainGroup;
    }

    group.userData.wallType = 'doorWindow';
    group.userData.wallSize = { width, height, thickness };
    group.userData.isWall = true;
    return group;
}


// ============================================================
//  地板 / 天花板
// ============================================================

/**
 * @param {{ width: number, depth: number }} opts
 */
export function createFloor({ width, depth }) {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), matFloor);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    return floor;
}

/**
 * @param {{ width: number, depth: number, height: number }} opts
 */
export function createCeiling({ width, depth, height }) {
    const ceilMat = matCeiling.clone();
    ceilMat.side = THREE.DoubleSide;
    ceilMat.polygonOffset = true;
    ceilMat.polygonOffsetFactor = -1;
    ceilMat.polygonOffsetUnits = -1;
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), ceilMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = height;
    ceil.userData.isOccluder = true;
    return ceil;
}


// ============================================================
//  内部：窗户几何体
// ============================================================

function createWindowGeometry(W, sill, top, offX) {
    const win = new THREE.Group();
    const H = top - sill;
    const fw = WIN_FRAME_W;
    const fd = WIN_FRAME_D;
    const cy = sill + H / 2;

    // 四条边框
    const frameTop = new THREE.Mesh(new THREE.BoxGeometry(W + fw * 2, fw, fd), matFrame);
    frameTop.position.set(offX, cy + H / 2 + fw / 2, 0);
    win.add(frameTop);

    const frameBot = new THREE.Mesh(new THREE.BoxGeometry(W + fw * 2, fw, fd), matFrame);
    frameBot.position.set(offX, cy - H / 2 - fw / 2, 0);
    win.add(frameBot);

    const frameLeft = new THREE.Mesh(new THREE.BoxGeometry(fw, H, fd), matFrame);
    frameLeft.position.set(offX - W / 2 - fw / 2, cy, 0);
    win.add(frameLeft);

    const frameRight = new THREE.Mesh(new THREE.BoxGeometry(fw, H, fd), matFrame);
    frameRight.position.set(offX + W / 2 + fw / 2, cy, 0);
    win.add(frameRight);

    // 玻璃
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(W, H), matGlass);
    glass.position.set(offX, cy, WIN_GLASS_Z);
    win.add(glass);

    // 十字窗棂
    const barH = new THREE.Mesh(new THREE.BoxGeometry(W, WIN_CROSSBAR, fd), matFrame);
    barH.position.set(offX, cy, 0);
    win.add(barH);
    const barV = new THREE.Mesh(new THREE.BoxGeometry(WIN_CROSSBAR, H, fd), matFrame);
    barV.position.set(offX, cy, 0);
    win.add(barV);

    // 窗台
    const sillMesh = new THREE.Mesh(
        new THREE.BoxGeometry(W + WIN_SILL_EXTRA, WIN_SILL_THICK, WIN_SILL_DEPTH),
        matFrame,
    );
    sillMesh.position.set(offX, sill, WIN_SILL_Z);
    win.add(sillMesh);

    return win;
}


// ============================================================
//  内部：窗帘几何体
// ============================================================

function createCurtainGeometry(W, sill, top, rodLength) {
    const group = new THREE.Group();

    const H = top - sill;
    const rodY = sill + H + CURTAIN_ROD_Y_OFFSET;
    const panelW = W / 2;

    // 两片窗帘
    [-1, 1].forEach(side => {
        const geo = new THREE.PlaneGeometry(panelW, H, CURTAIN_PANEL_SEGMENTS, CURTAIN_PANEL_SEGMENTS);
        const pos = geo.attributes.position;
        const origPositions = new Float32Array(pos.array.length);
        origPositions.set(pos.array);

        const curtain = new THREE.Mesh(geo, matCurtain);
        curtain.position.set(side * panelW / 2, sill + H / 2, CURTAIN_Z_OFFSET);
        curtain.castShadow = true;
        curtain.userData.side = side;
        curtain.userData.origPositions = origPositions;
        group.add(curtain);
    });

    // 窗帘杆
    const rod = new THREE.Mesh(
        new THREE.CylinderGeometry(CURTAIN_ROD_RADIUS, CURTAIN_ROD_RADIUS, rodLength, CURTAIN_ROD_SEGMENTS),
        matMetal,
    );
    rod.rotation.z = Math.PI / 2;
    rod.position.set(0, rodY, CURTAIN_Z_OFFSET);
    group.add(rod);

    // 端头装饰
    [-1, 1].forEach(side => {
        const cap = new THREE.Mesh(
            new THREE.SphereGeometry(CURTAIN_CAP_RADIUS, CURTAIN_CAP_SEGMENTS, CURTAIN_CAP_SEGMENTS),
            matMetal,
        );
        cap.position.set(side * rodLength / 2, rodY, CURTAIN_Z_OFFSET);
        group.add(cap);
    });

    return group;
}


// ============================================================
//  内部：门几何体
// ============================================================

function createDoorGeometry(DW, DH, openDirection = 'left') {
    const group = new THREE.Group();

    const panelW = DW - DOOR_PANEL_GAP;
    const panelH = DH - DOOR_PANEL_HEIGHT_GAP;
    const ft = FRAME_T;
    const fd = FRAME_D;

    // 门框（上 + 左 + 右）
    const topBar = new THREE.Mesh(new THREE.BoxGeometry(DW + ft * 2, ft, fd), matFrame);
    topBar.position.set(0, DH + ft / 2, 0);
    group.add(topBar);

    const leftBar = new THREE.Mesh(new THREE.BoxGeometry(ft, DH + ft, fd), matFrame);
    leftBar.position.set(-DW / 2 - ft / 2, DH / 2, 0);
    group.add(leftBar);

    const rightBar = new THREE.Mesh(new THREE.BoxGeometry(ft, DH + ft, fd), matFrame);
    rightBar.position.set(DW / 2 + ft / 2, DH / 2, 0);
    group.add(rightBar);

    // 门板（绕一侧边旋转）
    const pivotX = openDirection === 'left' ? -DW / 2 : DW / 2;
    const doorPivot = new THREE.Group();
    doorPivot.position.set(pivotX, 0, 0);

    const doorPanel = new THREE.Mesh(
        new THREE.BoxGeometry(panelW, panelH, DOOR_PANEL_THICK),
        matWood,
    );
    const panelOffsetX = openDirection === 'left' ? panelW / 2 : -panelW / 2;
    doorPanel.position.set(panelOffsetX, panelH / 2, 0);
    doorPanel.castShadow = true;
    doorPivot.add(doorPanel);

    // 门把手
    const handleGroup = new THREE.Group();
    const handleBar = new THREE.Mesh(
        new THREE.CylinderGeometry(HANDLE_RADIUS, HANDLE_RADIUS, HANDLE_LENGTH, 8),
        matMetal,
    );
    handleBar.rotation.x = Math.PI / 2;
    handleGroup.add(handleBar);

    const handleBase = new THREE.Mesh(
        new THREE.CylinderGeometry(HANDLE_RADIUS * 2, HANDLE_RADIUS * 2, 0.01, 12),
        matMetal,
    );
    handleBase.rotation.x = Math.PI / 2;
    handleGroup.add(handleBase);

    const handlePosX = openDirection === 'left'
        ? panelW / 2 - HANDLE_OFFSET_X
        : -panelW / 2 + HANDLE_OFFSET_X;
    handleGroup.position.set(handlePosX, panelH / 2, DOOR_PANEL_THICK / 2 + HANDLE_LENGTH / 2);
    doorPivot.add(handleGroup);

    group.add(doorPivot);

    group.userData.doorPivot = doorPivot;
    return group;
}
