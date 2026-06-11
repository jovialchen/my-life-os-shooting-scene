/**
 * 外壳房子 —— 经典美式独栋小屋外观
 * 包裹整个公寓，永远可见，外墙门窗与室内对齐
 */
import * as THREE from 'three';
import { matSiding, matTrim, matGround, matGlass, matFrame, matWood, matMetal } from '../materials.js';

// ── 壳体尺寸 ──
const SHELL_T   = 0.2;    // 外墙厚度
const WALL_TOP  = 3.5;    // 墙顶 (= ROOM_HEIGHT)
const EAVE_Z    = 5;      // 公寓中心 z（屋脊位置）

// 外墙位置（紧贴公寓内墙外表面：内墙外表面 ± 外壳半厚）
const WALL_T_INT = 0.12;                              // 内墙厚度
const SOUTH_Z = -(3.5 + WALL_T_INT / 2) - SHELL_T / 2; // -3.76
const NORTH_Z =  (13.5 + WALL_T_INT / 2) + SHELL_T / 2; // 13.76
const WEST_X  = -(16 + WALL_T_INT / 2) - SHELL_T / 2;  // -16.26
const EAST_X  =  (16 + WALL_T_INT / 2) + SHELL_T / 2;  // 16.26

// 墙体范围
const WALL_MIN_X = WEST_X;
const WALL_MAX_X = EAST_X;
const WALL_LEN   = WALL_MAX_X - WALL_MIN_X;

// ── 窗户参数（与室内一致）──────────────────────────────
const WIN_W       = 5;
const WIN_SILL    = 0.25;
const WIN_TOP     = 3.25;
const WIN_H       = WIN_TOP - WIN_SILL;  // 3.0
const FRAME_W     = 0.1;                 // 窗框宽度
const FRAME_DEPTH = 0.06;                // 窗框凸出厚度

// ── 门参数（与室内一致）────────────────────────────────
const DOOR_W   = 1.2;
const DOOR_H   = 2.4;
const DOOR_Z   = 5;   // 门在西墙上的 z 位置

// ============================================================
//  工具函数
// ============================================================

/** 创建一面带洞口的墙（Box 分块拼接） */
function wallWithOpenings(wallW, wallH, thickness, openings, material) {
    const g = new THREE.Group();
    const pieces = [];

    // 排序并归并开口区间
    const sorted = openings.slice().sort((a, b) => a.x - b.x);
    let cursor = -wallW / 2;
    for (const op of sorted) {
        const left  = op.x - op.w / 2;
        const right = op.x + op.w / 2;
        if (left > cursor + 0.001) {
            pieces.push({ x: (cursor + left) / 2, w: left - cursor });
        }
        cursor = right;
    }
    if (cursor < wallW / 2 - 0.001) {
        pieces.push({ x: (cursor + wallW / 2) / 2, w: wallW / 2 - cursor });
    }

    // 上方整条横梁（覆盖全宽，在所有洞口之上）
    const maxTop = openings.reduce((m, o) => Math.max(m, o.y + o.h / 2), 0);
    if (maxTop < wallH - 0.001) {
        const h = wallH - maxTop;
        const m = new THREE.Mesh(new THREE.BoxGeometry(wallW, h, thickness), material);
        m.position.set(0, maxTop + h / 2, 0);
        m.castShadow = true;
        m.receiveShadow = true;
        g.add(m);
    }

    // 每段竖直墙块
    for (const p of pieces) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(p.w, wallH, thickness), material);
        m.position.set(p.x, wallH / 2, 0);
        m.castShadow = true;
        m.receiveShadow = true;
        g.add(m);
    }

    return g;
}

/** 在洞口处添加窗户（框架 + 玻璃 + 外窗台） zSign: -1 = -z 面（南/北/东墙），+1 = +z 面（西墙） */
function addWindow(group, winW, sillY, topY, wallThickness, zSign) {
    const winH = topY - sillY;
    const cy   = (sillY + topY) / 2;
    const oz   = zSign * (wallThickness / 2 + FRAME_DEPTH / 2);

    // 外框架（4 条）
    const top = new THREE.Mesh(new THREE.BoxGeometry(winW + FRAME_W * 2, FRAME_W, FRAME_DEPTH), matFrame);
    top.position.set(0, topY + FRAME_W / 2, oz);
    group.add(top);
    const bot = new THREE.Mesh(new THREE.BoxGeometry(winW + FRAME_W * 2, FRAME_W, FRAME_DEPTH), matFrame);
    bot.position.set(0, sillY - FRAME_W / 2, oz);
    group.add(bot);
    const lft = new THREE.Mesh(new THREE.BoxGeometry(FRAME_W, winH, FRAME_DEPTH), matFrame);
    lft.position.set(-winW / 2 - FRAME_W / 2, cy, oz);
    group.add(lft);
    const rgt = new THREE.Mesh(new THREE.BoxGeometry(FRAME_W, winH, FRAME_DEPTH), matFrame);
    rgt.position.set(winW / 2 + FRAME_W / 2, cy, oz);
    group.add(rgt);

    // 中梃（十字）
    const midH = new THREE.Mesh(new THREE.BoxGeometry(winW, 0.06, FRAME_DEPTH), matFrame);
    midH.position.set(0, cy, oz);
    group.add(midH);
    const midV = new THREE.Mesh(new THREE.BoxGeometry(0.06, winH, FRAME_DEPTH), matFrame);
    midV.position.set(0, cy, oz);
    group.add(midV);

    // 玻璃
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(winW, winH), matGlass);
    if (zSign < 0) glass.rotation.y = Math.PI; // 翻转朝外
    glass.position.set(0, cy, zSign * (wallThickness / 2 + 0.01));
    group.add(glass);

    // 外窗台（向外凸出的窄板）
    const sill = new THREE.Mesh(new THREE.BoxGeometry(winW + 0.2, 0.05, 0.15), matTrim);
    sill.position.set(0, sillY - 0.025, zSign * (wallThickness / 2 + 0.075));
    group.add(sill);
}

/** 在洞口处添加门（框架 + 可旋转门板 + 把手） zSign: +1 = +z 面（西墙），-1 = -z 面 */
function addDoor(group, doorW, doorH, wallThickness, zSign) {
    const cy = doorH / 2;
    const oz = zSign * (wallThickness / 2 + 0.04);
    const pz = zSign * (wallThickness / 2 + 0.03);

    // 门框（静态）
    const frameTop = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.12, 0.12, 0.08), matFrame);
    frameTop.position.set(0, doorH + 0.06, oz);
    group.add(frameTop);
    const frameL = new THREE.Mesh(new THREE.BoxGeometry(0.12, doorH, 0.08), matFrame);
    frameL.position.set(-doorW / 2 - 0.06, cy, oz);
    group.add(frameL);
    const frameR = new THREE.Mesh(new THREE.BoxGeometry(0.12, doorH, 0.08), matFrame);
    frameR.position.set(doorW / 2 + 0.06, cy, oz);
    group.add(frameR);

    // 门板 pivot（绕左侧铰链旋转）
    const doorPivot = new THREE.Group();
    doorPivot.position.set(-doorW / 2, 0, pz);
    group.add(doorPivot);

    const panel = new THREE.Mesh(new THREE.BoxGeometry(doorW, doorH, 0.06), matWood);
    panel.position.set(doorW / 2, cy, 0);
    doorPivot.add(panel);

    // 把手
    const handle = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), matMetal);
    handle.position.set(doorW * 0.75, cy, zSign * 0.04);
    doorPivot.add(handle);

    // 暴露交互状态
    group.userData.doorPivot = doorPivot;
    group.userData.isOpen = false;
    group.userData.targetRotation = 0;
}

// ============================================================
//  主函数
// ============================================================

export function createHouseShell() {
    const house = new THREE.Group();
    house.name = 'houseShell';

    // ── 四面外墙 ──

    // 南墙（4 个窗户，对应南排 4 间房的南窗）
    const southOpenings = [
        { x: -12, w: WIN_W, y: (WIN_SILL + WIN_TOP) / 2, h: WIN_H },
        { x: -4,  w: WIN_W, y: (WIN_SILL + WIN_TOP) / 2, h: WIN_H },
        { x:  4,  w: WIN_W, y: (WIN_SILL + WIN_TOP) / 2, h: WIN_H },
        { x: 12,  w: WIN_W, y: (WIN_SILL + WIN_TOP) / 2, h: WIN_H },
    ];
    const southWall = wallWithOpenings(WALL_LEN, WALL_TOP, SHELL_T, southOpenings, matSiding);
    southWall.position.set(0, 0, SOUTH_Z);
    // 南墙窗户：从外侧看，窗户在墙的南面（外侧）
    for (const op of southOpenings) {
        const wg = new THREE.Group();
        addWindow(wg, op.w, WIN_SILL, WIN_TOP, SHELL_T, -1);
        wg.position.set(op.x, 0, 0);
        southWall.add(wg);
    }
    house.add(southWall);

    // 北墙（4 个窗户，对应北排 4 间房的北窗）
    const northOpenings = [
        { x: -12, w: WIN_W, y: (WIN_SILL + WIN_TOP) / 2, h: WIN_H },
        { x: -4,  w: WIN_W, y: (WIN_SILL + WIN_TOP) / 2, h: WIN_H },
        { x:  4,  w: WIN_W, y: (WIN_SILL + WIN_TOP) / 2, h: WIN_H },
        { x: 12,  w: WIN_W, y: (WIN_SILL + WIN_TOP) / 2, h: WIN_H },
    ];
    const northWall = wallWithOpenings(WALL_LEN, WALL_TOP, SHELL_T, northOpenings, matSiding);
    northWall.position.set(0, 0, NORTH_Z);
    northWall.rotation.y = Math.PI; // 翻转，窗户朝北（外侧）
    for (const op of northOpenings) {
        const wg = new THREE.Group();
        addWindow(wg, op.w, WIN_SILL, WIN_TOP, SHELL_T, -1);
        wg.position.set(op.x, 0, 0);
        northWall.add(wg);
    }
    house.add(northWall);

    // 西墙（1 个门，对应走廊出口）
    // rotation.y = -PI/2 后 local_x → world_z = local_x
    // 墙中心需对齐建筑中心 world_z = EAVE_Z = 5，用偏移组实现
    const wallDepth = NORTH_Z - SOUTH_Z;  // 18
    const westOpenings = [
        { x: 0, w: DOOR_W, y: DOOR_H / 2, h: DOOR_H },  // 门在墙中心 = world_z = EAVE_Z
    ];
    const westWall = wallWithOpenings(wallDepth, WALL_TOP, SHELL_T, westOpenings, matSiding);
    const doorGroup = new THREE.Group();
    addDoor(doorGroup, DOOR_W, DOOR_H, SHELL_T, 1);
    westWall.add(doorGroup);
    // 偏移组：墙中心从 local_x=0 移到 local_x=EAVE_Z，旋转后对齐 world_z=EAVE_Z
    const westPivot = new THREE.Group();
    westPivot.add(westWall);
    westPivot.rotation.y = -Math.PI / 2;
    westPivot.position.set(WEST_X, 0, EAVE_Z);
    house.add(westPivot);

    // 东墙（实墙，无旋转，z 维度 = wallDepth，居中对齐建筑 z = EAVE_Z）
    const eastWall = new THREE.Mesh(
        new THREE.BoxGeometry(SHELL_T, WALL_TOP, wallDepth),
        matSiding,
    );
    eastWall.position.set(EAST_X, WALL_TOP / 2, EAVE_Z);
    eastWall.castShadow = true;
    eastWall.receiveShadow = true;
    house.add(eastWall);

    // ── 屋顶（待重做）──

    // ── 地面（圆形草地）──
    const GRASS_RADIUS = 25;
    const GRASS_CENTER_X = 0;
    const GRASS_CENTER_Z = EAVE_Z; // 公寓中心 z=5
    const ground = new THREE.Mesh(
        new THREE.CircleGeometry(GRASS_RADIUS, 64),
        matGround,
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(GRASS_CENTER_X, -0.01, GRASS_CENTER_Z);
    ground.receiveShadow = true;
    house.add(ground);

    return {
        group: house,
        door: doorGroup,
        grass: { centerX: GRASS_CENTER_X, centerZ: GRASS_CENTER_Z, radius: GRASS_RADIUS },
    };
}
