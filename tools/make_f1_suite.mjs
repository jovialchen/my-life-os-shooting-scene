/** 一楼套房生成器（纯 Node 写 GLB，无需 Blender）
 *
 * 2026-09-10 一楼改版：两个 10×12×4.5 高厅（西=客厅、东=厨房），
 * 中间 3×12 走廊联通，走廊北面尽头门进客卫（8×10，比客厅略小）。
 * **客厅和厨房都有悬空楼梯**（客厅在 +x 墙=进门面窗左手边；厨房在 -x 墙=
 * 右手边），走廊门：客厅在 -x 墙 z2.2（右手边），厨房在 +x 墙 z2.2（左手边）
 * ——走廊门都在靠中厅一侧。两梯都触发传送学习室（学习室"下楼"门回客厅）。
 * 本生成器取代 tools/make_room_living.mjs（客厅）与 make_rooms.mjs 里
 * 的 f1_kitchen / f1_bath 两个规格。
 *
 * 平面（世界坐标语义，各房间仍是独立场景）：
 *   西翼 客厅 10×12×4.5   —— 南墙大门+2 拱窗，北墙 3 大拱窗+窗帘（偏 -x），
 *                           +x 墙悬空楼梯（→学习室），-x 墙门→走廊（z2.2 右手边）
 *   中厅 走廊 3×12×3.2    —— 西/东墙门→客厅/厨房（靠南端），北尽头门→客卫，
 *                           南墙 2 拱窗；护墙板 + 2 盏吊灯 + 长地毯（深邃感）
 *   中厅北 客卫 8×10×3.5  —— 南墙门→走廊，北墙 3 拱窗（外壳 W3），浴缸/双盆/马桶
 *   东翼 厨房 10×12×4.5   —— 南墙大门+2 拱窗，北墙 3 拱窗，+x 墙门→走廊（左手边），
 *                           -x 墙悬空楼梯（右手边，→学习室）
 *
 * 规范同原 make_room_living.mjs：原点在南墙门口地板中心（y 上，z 进房间）；
 * WALK_ 逻辑面抬高 0.015 只作导航数据；门 origin 在铰链边 + door extras；
 * 窗景片 MAT_window_view 标 nav_ignore；家具不标属性（自动障碍）。
 *
 * 用法: node tools/make_f1_suite.mjs
 *   → models/room_living.glb / room_corridor.glb / room_bath_f1.glb / room_kitchen.glb
 */
import { writeFileSync } from 'node:fs';
import { PALETTE } from './room_palette.mjs';

const WT = 0.1;
const DOOR_W = 1.0, DOOR_H = 2.1;

// 2026-09-11：厨房/客卫的简易家具先撤掉（后续用真实家具模型替换），置 true 恢复
const WITH_FURNITURE = false;

// ── 楼梯参数（东墙悬空梯，客厅/厨房共用同一套；平台 y3.0 = 二楼标高）──
const ST = {
    x0: 3.9, z0: 5.9, steps: 17, top: 3.0,
    tread: 0.28, rise: 3.0 / 17,
    landingZ0: 5.9 + 17 * 0.28,    // = 10.66
};
const SHAFT = { x0: 3.75, z0: 7.35, base: 3.0, top: 5.2 };
const HOLE = { x0: 3.8, z0: 7.4 };   // 天花板井口（x1/z1 = 房间东/北边）
const TOP_DOOR = { x0: 4.0, x1: 5.0, y1: 5.0 };

// sRGB hex -> glTF baseColorFactor（线性）
function hexToLinear(hex) {
    const h = hex.replace('#', '');
    const f = (i) => {
        const c = parseInt(h.slice(i, i + 2), 16) / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return [f(0), f(2), f(4), 1];
}

// ── 几何拼装（平面着色：每面独立顶点 + 法线）──
const FACES = [
    [[1, 0, 0], [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]]],
    [[-1, 0, 0], [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]]],
    [[0, 1, 0], [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]]],
    [[0, -1, 0], [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]]],
    [[0, 0, 1], [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]]],
    [[0, 0, -1], [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]]],
];

function makePart() { return { verts: [], norms: [], idx: [] }; }

function pushBox(part, min, max) {
    for (const [n, corners] of FACES) {
        const b = part.verts.length / 3;
        for (const c of corners) {
            part.verts.push(
                c[0] ? max[0] : min[0],
                c[1] ? max[1] : min[1],
                c[2] ? max[2] : min[2]);
            part.norms.push(...n);
        }
        part.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
}

/** 水平四边形（WALK 逻辑面：单面 +y） */
function pushQuadXZ(part, x0, z0, x1, z1, y) {
    const b = part.verts.length / 3;
    part.verts.push(x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1);
    for (let i = 0; i < 4; i++) part.norms.push(0, 1, 0);
    part.idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
}

/** 带洞口的墙（沿 x 方向；hole.arch=true 时洞顶为台阶拱：起拱线 y1-0.3，
 *  两级收缩 ×0.7/×0.35 各 0.15 高——与外壳 WINDOW_01 同一语汇） */
function pushWallX(part, z0, z1, x0, x1, h, holes) {
    const sorted = [...holes].sort((a, b) => a.a0 - b.a0);
    let cur = x0;
    for (const hole of sorted) {
        if (hole.a0 - cur > 0.001) pushBox(part, [cur, 0, z0], [hole.a0, h, z1]);
        if (hole.y0 > 0.001) pushBox(part, [hole.a0, 0, z0], [hole.a1, hole.y0, z1]);
        if (h - hole.y1 > 0.001) pushBox(part, [hole.a0, hole.y1, z0], [hole.a1, h, z1]);
        if (hole.arch) {
            const cx = (hole.a0 + hole.a1) / 2, w = hole.a1 - hole.a0;
            const ys = hole.y1 - 0.3;
            for (const [f, yA, yB] of [[0.7, ys, ys + 0.15], [0.35, ys + 0.15, hole.y1]]) {
                const hw = w * f / 2;
                pushBox(part, [hole.a0, yA, z0], [cx - hw, yB, z1]);
                pushBox(part, [cx + hw, yA, z0], [hole.a1, yB, z1]);
            }
        }
        cur = Math.max(cur, hole.a1);
    }
    if (x1 - cur > 0.001) pushBox(part, [cur, 0, z0], [x1, h, z1]);
}

/** 带洞口的墙（沿 z 方向，洞口为矩形——门洞用） */
function pushWallZ(part, x0, x1, z0, z1, h, holes) {
    const sorted = [...holes].sort((a, b) => a.a0 - b.a0);
    let cur = z0;
    for (const hole of sorted) {
        if (hole.a0 - cur > 0.001) pushBox(part, [x0, 0, cur], [x1, h, hole.a0]);
        if (hole.y0 > 0.001) pushBox(part, [x0, 0, hole.a0], [x1, hole.y0, hole.a1]);
        if (h - hole.y1 > 0.001) pushBox(part, [x0, hole.y1, hole.a0], [x1, h, hole.a1]);
        cur = Math.max(cur, hole.a1);
    }
    if (z1 - cur > 0.001) pushBox(part, [x0, 0, cur], [x1, h, z1]);
}

// ── 房间装配器 ──
function roomBuilder() {
    const parts = [];
    const add = (name, mat, build, extras = null, translation = null) => {
        const part = makePart();
        build(part);
        parts.push({ name, mat, extras, translation, part });
    };
    const B = (p, x0, y0, z0, x1, y1, z1) => pushBox(p, [x0, y0, z0], [x1, y1, z1]);
    return { parts, add, B };
}

// 与墙洞边共面的框面错开 E=8mm 防 z-fighting
const E = 0.008;

/** 门框（S/N 墙，沿 x；f = 墙房内侧面 z，o = 出房方向：南墙 +1 / 北墙 -1） */
function frameX(p, off, f, o) {
    const j = 0.06;
    const z0 = Math.min(f - o * 0.02, f + o * (WT + 0.02));
    const z1 = Math.max(f - o * 0.02, f + o * (WT + 0.02));
    const x0 = off - DOOR_W / 2, x1 = off + DOOR_W / 2;
    pushBox(p, [x0 - j, 0, z0], [x0 + E, DOOR_H + j, z1]);
    pushBox(p, [x1 - E, 0, z0], [x1 + j, DOOR_H + j, z1]);
    pushBox(p, [x0 - j, DOOR_H - E, z0], [x1 + j, DOOR_H + j, z1]);
}

/** 门框（W/E 墙，沿 z；f = 墙房内侧面 x，o = 出房方向：西墙 +1 / 东墙 -1） */
function frameZ(p, c, f, o) {
    const j = 0.06;
    const x0 = Math.min(f - o * 0.02, f + o * (WT + 0.02));
    const x1 = Math.max(f - o * 0.02, f + o * (WT + 0.02));
    const z0 = c - DOOR_W / 2, z1 = c + DOOR_W / 2;
    pushBox(p, [x0, 0, z0 - j], [x1, DOOR_H + j, z0 + E]);
    pushBox(p, [x0, 0, z1 - E], [x1, DOOR_H + j, z1 + j]);
    pushBox(p, [x0, DOOR_H - E, z0 - j], [x1, DOOR_H + j, z1 + j]);
}

/** 拱窗框（边框到起拱线 + 拱顶踏步框 + 矩形段十字棂 + 窗台板）
 *  f = 墙房内侧面 z，o = 出房方向（北墙 +1 / 南墙 -1） */
function winFrame(p, x0, x1, y0, y1, f, o) {
    const z0 = Math.min(f - o * 0.03, f + o * (WT + 0.03));
    const z1 = Math.max(f - o * 0.03, f + o * (WT + 0.03));
    const m0 = Math.min(f, f + o * WT), m1 = Math.max(f, f + o * WT);
    const sz0 = Math.min(f - o * 0.07, z1), sz1 = Math.max(f - o * 0.07, z0);
    const ys = y1 - 0.3;
    const j2 = 0.06;
    pushBox(p, [x0 - j2, y0 - j2, z0], [x0 + E, ys + j2, z1]);
    pushBox(p, [x1 - E, y0 - j2, z0], [x1 + j2, ys + j2, z1]);
    pushBox(p, [x0 - j2 - 0.02, y0 - j2 - 0.04, sz0], [x1 + j2 + 0.02, y0 + E, sz1]); // 窗台板
    const cx = (x0 + x1) / 2, cy = (y0 + ys) / 2, m = 0.028;
    pushBox(p, [cx - m, y0 + E, m0], [cx + m, ys - E, m1]);
    pushBox(p, [x0 + E, cy - m, m0], [x1 - E, cy + m, m1]);
    const w = x1 - x0, hw1 = w * 0.7 / 2, hw2 = w * 0.35 / 2;
    pushBox(p, [x0 - j2, ys - E, z0], [x1 + j2, ys + j2, z1]);
    pushBox(p, [cx - hw1 - j2, ys - E, z0], [cx - hw1 + E, ys + 0.15 - E, z1]);
    pushBox(p, [cx + hw1 - E, ys - E, z0], [cx + hw1 + E, ys + 0.15 - E, z1]);
    pushBox(p, [cx - hw2 - j2, ys + 0.15 - E, z0], [cx - hw2 + E, y1 - E, z1]);
    pushBox(p, [cx + hw2 - E, ys + 0.15 - E, z0], [cx + hw2 + E, y1 - E, z1]);
    pushBox(p, [cx - hw2 - j2, y1 - E, z0], [cx + hw2 + j2, y1 + j2, z1]);
}

// ── 门（origin 在铰链底边；doors.js: dir left=-1 / right=+1 绕 y 转 90°）──
function doorExtras(target) {
    return {
        interactable_type: 'door',
        door_swing_angle: 90.0,
        door_swing_dir: target.dir,
        door_slide: false,
        door_locked: false,
        door_target_scene: target.scene,
        door_target_spawn: target.spawn,
    };
}
/** 南墙门：门板沿 +x，origin 西侧铰链，dir=left → 开向屋内 +z */
function doorS(add, name, off, target) {
    add(name, 'MAT_door', (p) => pushBox(p, [0, 0, -0.02], [0.96, 2.06, 0.02]),
        doorExtras({ ...target, dir: 'left' }), [off - DOOR_W / 2 + 0.02, 0.02, 0]);
}
/** 北墙门：门板沿 +x，origin 西侧铰链，dir=right → 开向屋内 -z */
function doorN(add, name, off, d, target) {
    add(name, 'MAT_door', (p) => pushBox(p, [0, 0, -0.02], [0.96, 2.06, 0.02]),
        doorExtras({ ...target, dir: 'right' }), [off - DOOR_W / 2 + 0.02, 0.02, d]);
}
/** 西墙门：门板沿 +z，origin 南侧铰链，dir=right → 开向屋内 +x */
function doorW(add, name, xw, c, target) {
    add(name, 'MAT_door', (p) => pushBox(p, [-0.02, 0, 0], [0.02, 2.06, 0.96]),
        doorExtras({ ...target, dir: 'right' }), [-xw, 0.02, c - 0.48]);
}
/** 东墙门：门板沿 +z，origin 南侧铰链，dir=left → 开向屋内 -x */
function doorE(add, name, xw, c, target) {
    add(name, 'MAT_door', (p) => pushBox(p, [-0.02, 0, 0], [0.02, 2.06, 0.96]),
        doorExtras({ ...target, dir: 'left' }), [xw, 0.02, c - 0.48]);
}

/** 窗帘一副（两片帘布 origin 各在外侧边缘，开帘 scale.x 收拢成褶；
 *  同 curtain_group 联动；nav_ignore 纯视觉/交互物） */
function addCurtain(add, { x0, x1, y0, y1, rodY, z0, z1, group }) {
    add(`CURTAIN_ROD_${group}`, 'MAT_frame', (p) => {
        pushBox(p, [x0 - 0.08, rodY - 0.03, z0 - 0.01], [x1 + 0.08, rodY + 0.03, z1 + 0.01]);
        pushBox(p, [x0 - 0.13, rodY - 0.05, z0 - 0.03], [x0 - 0.06, rodY + 0.05, z1 + 0.03]);
        pushBox(p, [x1 + 0.06, rodY - 0.05, z0 - 0.03], [x1 + 0.13, rodY + 0.05, z1 + 0.03]);
    }, { nav_ignore: true });
    const half = (x1 - x0) / 2;
    const extras = { interactable_type: 'curtain', curtain_group: group, nav_ignore: true };
    add(`CURTAIN_L_${group}`, 'MAT_curtain', (p) =>
        pushBox(p, [0, y0, z0], [half, y1, z1]), extras, [x0, 0, 0]);
    add(`CURTAIN_R_${group}`, 'MAT_curtain', (p) =>
        pushBox(p, [-half, y0, z0], [0, y1, z1]), extras, [x1, 0, 0]);
}

/** 东/西墙悬空梯全套（17 步→y3.0 平台 + 挑高井道 + 顶部门洞暗龛 + WALK 导航面）。
 *  side=+1 东墙（厨房）/ side=-1 西墙（客厅，x 镜像；栏杆在靠房间中轴一侧）。
 *  要求房间 W=10、D=12、H≥4.5；北墙/天花板由调用方开对应豁口（SHAFT/HOLE） */
function buildStairs(add, D, side = 1) {
    const xw = 5;
    const m = (x) => side * x;
    const box = (p, min, max) => pushBox(p,
        [Math.min(m(min[0]), m(max[0])), min[1], min[2]],
        [Math.max(m(min[0]), m(max[0])), max[1], max[2]]);
    const quad = (p, x0, z0, x1, z1, y) =>
        pushQuadXZ(p, Math.min(m(x0), m(x1)), z0, Math.max(m(x0), m(x1)), z1, y);
    // 楼梯每步顶面 + 顶部平台 WALK 面（导航只认这些面；可见梯体是障碍）
    add('WALK_stairs', 'MAT_stairs', (p) => {
        for (let k = 1; k <= ST.steps; k++) {
            const z0 = ST.z0 + (k - 1) * ST.tread;
            quad(p, ST.x0 - 0.1, k === 1 ? z0 - 0.05 : z0, xw - 0.05, z0 + ST.tread, k * ST.rise + 0.015);
        }
        quad(p, ST.x0 - 0.05, ST.landingZ0, xw - 0.05, D + 0.3, ST.top + 0.015);
    }, {
        surface_walkable: true,
        stairs_to: [m((TOP_DOOR.x0 + TOP_DOOR.x1) / 2), 3.02, D + 0.05],
    });
    // 可见梯体：0.07 厚悬臂踏步板（端头插墙、梯下挑空）+ 平台薄板。
    // 踏步是障碍但 nav_no_inflate（膨胀会把上级踏步净空判定扩散到下一级格）
    add('STAIRS', 'MAT_tread', (p) => {
        for (let k = 1; k <= ST.steps; k++) {
            const z0 = ST.z0 + (k - 1) * ST.tread, top = k * ST.rise;
            box(p, [ST.x0 - 0.02, top - 0.07, z0], [xw, top, z0 + ST.tread]);
        }
        box(p, [ST.x0 - 0.05, ST.top - 0.15, ST.landingZ0], [xw + 0.05, ST.top, D + 0.05]);
    }, { nav_no_inflate: true });
    // 内缘细栏杆（每步立柱 + 踏步式细扶手，扶手高 0.8）
    add('RAILING', 'MAT_railing', (p) => {
        for (let k = 1; k <= ST.steps; k++) {
            const z0 = ST.z0 + (k - 1) * ST.tread, top = k * ST.rise;
            box(p, [ST.x0 - 0.04, top, z0 + 0.11], [ST.x0 + 0.01, top + 0.72, z0 + 0.16]);
            box(p, [ST.x0 - 0.06, top + 0.72, z0], [ST.x0 + 0.04, top + 0.82, z0 + ST.tread]);
        }
    });
    // 挑高井道（y 3.0..5.2：内/南/外墙 + 北墙顶部门洞 + 顶盖）
    add('SHAFT', 'MAT_wall_interior', (p) => {
        box(p, [SHAFT.x0, SHAFT.base, SHAFT.z0], [SHAFT.x0 + WT, SHAFT.top, D + WT]);       // 内墙
        box(p, [SHAFT.x0, SHAFT.base, SHAFT.z0], [xw + WT, SHAFT.top, SHAFT.z0 + WT]);       // 南墙
        box(p, [xw, SHAFT.base, SHAFT.z0], [xw + WT, SHAFT.top, D + WT]);                    // 外墙（接房间侧墙）
        box(p, [SHAFT.x0, SHAFT.base, D], [TOP_DOOR.x0, SHAFT.top, D + WT]);                 // 北墙·门洞一侧
        box(p, [TOP_DOOR.x1, SHAFT.base, D], [xw + WT, SHAFT.top, D + WT]);                  // 北墙·门洞另一侧
        box(p, [TOP_DOOR.x0, TOP_DOOR.y1, D], [TOP_DOOR.x1, SHAFT.top, D + WT]);             // 门洞过梁
        box(p, [SHAFT.x0 - 0.05, SHAFT.top, SHAFT.z0 - 0.05],
               [xw + WT + 0.05, SHAFT.top + 0.15, D + WT + 0.05]);                           // 顶盖
    });
    // 顶部门洞暗龛（传送触发区在门洞处，config.js triggers）
    add('STAIRWELL', 'MAT_stairwell', (p) =>
        box(p, [TOP_DOOR.x0 - 0.05, SHAFT.base - 0.05, D + WT],
               [TOP_DOOR.x1 + 0.05, TOP_DOOR.y1 + 0.1, D + WT + 0.5]),
        { nav_ignore: true });
}

/** 楼梯房的 WALK_floor：主地板让开楼梯带，楼梯带整条铺面
 *  （低矮踏步下由净空规则自动剔除，高段梯下+平台壁龛可走）
 *  side=+1 楼梯带在东（x>3.85）/ side=-1 在西（x<-3.85） */
function walkFloorWithStairs(add, W, D, mat = 'MAT_floor_wood', side = 1) {
    add('WALK_floor', mat, (p) => {
        const [sx0, sx1] = side > 0 ? [ST.x0 - 0.05, W / 2 - 0.05] : [-W / 2 + 0.05, -ST.x0 + 0.05];
        const [mx0, mx1] = side > 0 ? [-W / 2 + 0.05, ST.x0 - 0.05] : [-ST.x0 + 0.05, W / 2 - 0.05];
        pushQuadXZ(p, mx0, 0.05, mx1, D - 0.05, 0.015);   // 主地板
        pushQuadXZ(p, sx0, 0.05, sx1, D - 0.05, 0.015);   // 楼梯带（含梯下/壁龛）
    }, { surface_walkable: true });
}

// ════════════════════════════════════════════════════════════
//  客厅（西翼 10×12×4.5）：南墙大门+2 拱窗，北墙 3 大拱窗+窗帘（偏 -x 让开楼梯）；
//  楼梯在 +x 墙（进门面窗左手边），走廊门在 -x 墙（右手边，z2.2）；
//  楼梯：17 步→y3.0 平台→顶部门洞触发传送学习室（config.js f1_living.triggers）
// ════════════════════════════════════════════════════════════
function buildLiving() {
    const W = 10, D = 12, H = 4.5, xw = W / 2;
    const WIN = { centers: [-3.5, -2.05, -0.6], width: 1.2, y0: 0.55, y1: 3.5 };
    const WIN_X = WIN.centers.map((c) => [c - WIN.width / 2, c + WIN.width / 2]);
    const S_WIN = { centers: [-2.8, 2.8], width: 0.87, y0: 0.55, y1: 2.45 };
    const S_WIN_X = S_WIN.centers.map((c) => [c - S_WIN.width / 2, c + S_WIN.width / 2]);
    const C_DOOR = 2.2;   // 走廊门中心 z（-x 墙，→ 走廊）
    const { parts, add } = roomBuilder();

    add('FLOOR_visible', 'MAT_floor_wood', (p) => pushBox(p, [-xw, -0.06, 0], [xw, 0, D]));
    walkFloorWithStairs(add, W, D, 'MAT_floor_wood', 1);

    add('WALLS', 'MAT_wall_interior', (p) => {
        pushWallX(p, -WT, 0, -xw, xw, H, [
            { a0: -DOOR_W / 2, a1: DOOR_W / 2, y0: 0, y1: DOOR_H },
            ...S_WIN_X.map(([a0, a1]) => ({ a0, a1, y0: S_WIN.y0, y1: S_WIN.y1, arch: true })),
        ]);
        // 北墙：3 拱窗（偏 -x）+ 井道 footprint 处平台层以上开豁口（+x 段）
        pushWallX(p, D, D + WT, -xw, xw, H, [
            ...WIN_X.map(([a0, a1]) => ({ a0, a1, y0: WIN.y0, y1: WIN.y1, arch: true })),
            { a0: SHAFT.x0, a1: xw, y0: ST.top, y1: H },
        ]);
        // -x 墙：走廊门洞（z 1.7..2.7），实心到顶
        pushWallZ(p, -xw - WT, -xw, -WT, D + WT, H,
            [{ a0: C_DOOR - DOOR_W / 2, a1: C_DOOR + DOOR_W / 2, y0: 0, y1: DOOR_H }]);
        // +x 墙（楼梯侧）：井道段（z ≥ SHAFT.z0）只砌到平台层
        pushBox(p, [xw, 0, -WT], [xw + WT, H, SHAFT.z0]);
        pushBox(p, [xw, 0, SHAFT.z0], [xw + WT, ST.top, D + WT]);
    });

    // 天花板（楼梯上段上方开井口——+x 段，井口向上接挑高井道）
    add('CEILING', 'MAT_ceiling_interior', (p) => {
        pushBox(p, [-xw - WT, H, -WT], [xw + WT, H + 0.12, HOLE.z0]);       // 南侧整板
        pushBox(p, [-xw - WT, H, HOLE.z0], [HOLE.x0, H + 0.12, D + WT]);    // 井口 -x 条
    });

    buildStairs(add, D, 1);

    add('FRAMES', 'MAT_frame', (p) => {
        frameX(p, 0, 0, 1);                                   // 南墙大门
        frameZ(p, C_DOOR, -xw, 1);                            // -x 墙走廊门
        for (const [x0, x1] of WIN_X) winFrame(p, x0, x1, WIN.y0, WIN.y1, D, 1);
        for (const [x0, x1] of S_WIN_X) winFrame(p, x0, x1, S_WIN.y0, S_WIN.y1, 0, -1);
    });

    add('VIEW_window', 'MAT_window_view', (p) =>
        pushBox(p, [WIN_X[0][0] - 0.4, WIN.y0 - 0.25, D + 0.4],
                   [WIN_X[WIN_X.length - 1][1] + 0.4, WIN.y1 + 0.25, D + 0.46]),
        { nav_ignore: true });
    add('VIEW_window_s', 'MAT_window_view', (p) =>
        pushBox(p, [S_WIN_X[0][0] - 0.4, S_WIN.y0 - 0.25, -0.46],
                   [S_WIN_X[S_WIN_X.length - 1][1] + 0.4, S_WIN.y1 + 0.25, -0.40]),
        { nav_ignore: true });

    // 窗帘：北墙整面一副 + 南墙门脸两窗各一副
    addCurtain(add, {
        x0: WIN_X[0][0] - 0.27, x1: WIN_X[WIN_X.length - 1][1] + 0.27,
        y0: 0.42, y1: 3.62, rodY: 3.63, z0: D - 0.12, z1: D - 0.06, group: 'north',
    });
    for (const [i, c] of S_WIN.centers.entries()) {
        addCurtain(add, {
            x0: c - S_WIN.width / 2 - 0.27, x1: c + S_WIN.width / 2 + 0.27,
            y0: 0.42, y1: 2.55, rodY: 2.60, z0: 0.06, z1: 0.12, group: `south_${i}`,
        });
    }

    doorS(add, 'DOOR_exit', 0, { scene: 'outdoor', spawn: 'houseWest' });
    doorW(add, 'DOOR_corridor', xw, C_DOOR, { scene: 'f1_corridor', spawn: 'fromLiving' });

    return parts;
}

// ════════════════════════════════════════════════════════════
//  走廊（中厅 3×12×3.2）：西/东墙门→客厅/厨房（靠南端 z2.2），
//  北尽头门→客卫；南墙 2 拱窗；护墙板 + 2 吊灯 + 长地毯（深邃感）
// ════════════════════════════════════════════════════════════
function buildCorridor() {
    const W = 3, D = 12, H = 3.2, xw = W / 2;
    const SIDE_DOOR = 2.2;                       // 西/东墙门中心 z
    const S_WIN = { centers: [-0.75, 0.75], width: 0.7, y0: 0.85, y1: 2.75 };
    const S_WIN_X = S_WIN.centers.map((c) => [c - S_WIN.width / 2, c + S_WIN.width / 2]);
    const { parts, add, B } = roomBuilder();

    add('FLOOR_visible', 'MAT_floor_wood', (p) => B(p, -xw, -0.06, 0, xw, 0, D));
    add('WALK_floor', 'MAT_floor_wood', (p) =>
        pushQuadXZ(p, -xw + 0.05, 0.05, xw - 0.05, D - 0.05, 0.015),
        { surface_walkable: true });

    add('WALLS', 'MAT_wall_interior', (p) => {
        pushWallX(p, -WT, 0, -xw, xw, H,
            S_WIN_X.map(([a0, a1]) => ({ a0, a1, y0: S_WIN.y0, y1: S_WIN.y1, arch: true })));
        pushWallX(p, D, D + WT, -xw, xw, H,
            [{ a0: -DOOR_W / 2, a1: DOOR_W / 2, y0: 0, y1: DOOR_H }]);
        pushWallZ(p, -xw - WT, -xw, -WT, D + WT, H,
            [{ a0: SIDE_DOOR - DOOR_W / 2, a1: SIDE_DOOR + DOOR_W / 2, y0: 0, y1: DOOR_H }]);
        pushWallZ(p, xw, xw + WT, -WT, D + WT, H,
            [{ a0: SIDE_DOOR - DOOR_W / 2, a1: SIDE_DOOR + DOOR_W / 2, y0: 0, y1: DOOR_H }]);
    });
    add('CEILING', 'MAT_ceiling_interior', (p) =>
        B(p, -xw - WT, H, -WT, xw + WT, H + 0.12, D + WT));

    add('FRAMES', 'MAT_frame', (p) => {
        frameX(p, 0, D, -1);                                  // 北尽头客卫门
        frameZ(p, SIDE_DOOR, -xw, 1);                         // 西墙客厅门
        frameZ(p, SIDE_DOOR, xw, -1);                         // 东墙厨房门
        for (const [x0, x1] of S_WIN_X) winFrame(p, x0, x1, S_WIN.y0, S_WIN.y1, 0, -1);
    });

    add('VIEW_window_s', 'MAT_window_view', (p) =>
        B(p, S_WIN_X[0][0] - 0.4, S_WIN.y0 - 0.25, -0.46,
             S_WIN_X[S_WIN_X.length - 1][1] + 0.4, S_WIN.y1 + 0.25, -0.40),
        { nav_ignore: true });

    // 护墙板（西/东长墙，高 0.95 + 顶线；门洞 z1.66..2.78 处断开，门板摆动区不压板）
    add('WAINSCOT', 'MAT_wainscot', (p) => {
        for (const s of [-1, 1]) {
            const x0 = s < 0 ? -xw : xw - 0.03, x1 = s < 0 ? -xw + 0.03 : xw;
            for (const [z0, z1] of [[0.02, 1.66], [2.78, D - 0.02]]) {
                B(p, x0, 0, z0, x1, 0.95, z1);
                B(p, x0 - (s < 0 ? 0 : 0.005), 0.95, z0, x1 + (s < 0 ? 0.005 : 0), 1.02, z1);
            }
        }
    });

    // 两盏吊灯（纵深方向的视觉节拍；config 光照的 PointLight 在走廊中段）
    add('LAMP', 'MAT_lamp', (p) => {
        for (const zc of [4.5, 8.5]) {
            B(p, -0.015, 2.62, zc - 0.015, 0.015, H, zc + 0.015);        // 吊线
            B(p, -0.18, 2.45, zc - 0.18, 0.18, 2.62, zc + 0.18);         // 灯罩
        }
    }, { nav_ignore: true });

    // 长地毯（纯装饰）
    add('RUG', 'MAT_rug', (p) => B(p, -0.6, 0.02, 3.2, 0.6, 0.035, 10.8), { nav_ignore: true });

    doorW(add, 'DOOR_living', xw, SIDE_DOOR, { scene: 'f1_living', spawn: 'fromCorridor' });
    doorE(add, 'DOOR_kitchen', xw, SIDE_DOOR, { scene: 'f1_kitchen', spawn: 'fromCorridor' });
    doorN(add, 'DOOR_bath', 0, D, { scene: 'f1_bath', spawn: 'default' });

    return parts;
}

// ════════════════════════════════════════════════════════════
//  客卫（中厅北 8×10×3.5，比客厅略小）：南墙门→走廊，北墙 3 拱窗（外壳 W3）
//  浴缸（东墙）+ 双盆洗手台（北墙西）+ 马桶（东北）+ 绿植
// ════════════════════════════════════════════════════════════
function buildBath() {
    const W = 8, D = 10, H = 3.5, xw = W / 2;
    const N_WIN = { centers: [-0.95, 0, 0.95], width: 0.87, y0: 0.9, y1: 2.6 };
    const N_WIN_X = N_WIN.centers.map((c) => [c - N_WIN.width / 2, c + N_WIN.width / 2]);
    const { parts, add, B } = roomBuilder();

    add('FLOOR_visible', 'MAT_floor_tile', (p) => B(p, -xw, -0.06, 0, xw, 0, D));
    add('WALK_floor', 'MAT_floor_tile', (p) =>
        pushQuadXZ(p, -xw + 0.05, 0.05, xw - 0.05, D - 0.05, 0.015),
        { surface_walkable: true });

    add('WALLS', 'MAT_wall_interior', (p) => {
        pushWallX(p, -WT, 0, -xw, xw, H,
            [{ a0: -DOOR_W / 2, a1: DOOR_W / 2, y0: 0, y1: DOOR_H }]);
        pushWallX(p, D, D + WT, -xw, xw, H,
            N_WIN_X.map(([a0, a1]) => ({ a0, a1, y0: N_WIN.y0, y1: N_WIN.y1, arch: true })));
        B(p, -xw - WT, 0, -WT, -xw, H, D + WT);
        B(p, xw, 0, -WT, xw + WT, H, D + WT);
    });
    add('CEILING', 'MAT_ceiling_interior', (p) =>
        B(p, -xw - WT, H, -WT, xw + WT, H + 0.12, D + WT));

    add('FRAMES', 'MAT_frame', (p) => {
        frameX(p, 0, 0, 1);
        for (const [x0, x1] of N_WIN_X) winFrame(p, x0, x1, N_WIN.y0, N_WIN.y1, D, 1);
    });

    add('VIEW_window', 'MAT_window_view', (p) =>
        B(p, N_WIN_X[0][0] - 0.4, N_WIN.y0 - 0.25, D + 0.4,
             N_WIN_X[N_WIN_X.length - 1][1] + 0.4, N_WIN.y1 + 0.25, D + 0.46),
        { nav_ignore: true });

    // 家具（浴缸/洗手台/马桶，含镜子）暂时撤掉，见 WITH_FURNITURE
    if (WITH_FURNITURE) {
    // 大浴缸（东墙）+ 水面
    add('FURN_tub', 'MAT_fixture', (p) => {
        B(p, 2.5, 0, 3.5, 3.9, 0.62, 5.6);
        B(p, 2.42, 0.58, 3.42, 3.98, 0.66, 5.68);   // 缸沿
    });
    add('FURN_tub_water', 'MAT_mirror', (p) => B(p, 2.62, 0.42, 3.62, 3.78, 0.46, 5.48),
        { nav_ignore: true });
    // 双盆洗手台（北墙西段，避开窗洞 x -1.385..1.385）
    add('FURN_vanity', 'MAT_fixture', (p) => {
        B(p, -3.7, 0, 9.15, -1.5, 0.85, 9.75);
        B(p, -3.35, 0.85, 9.3, -2.75, 0.95, 9.65);
        B(p, -2.45, 0.85, 9.3, -1.85, 0.95, 9.65);
    });
    add('MIRROR', 'MAT_mirror', (p) => {
        B(p, -3.4, 1.15, D - 0.06, -2.7, 1.85, D - 0.02);
        B(p, -2.5, 1.15, D - 0.06, -1.8, 1.85, D - 0.02);
    }, { nav_ignore: true });
    // 马桶（东北角，避开窗洞）
    add('FURN_toilet', 'MAT_fixture', (p) => {
        B(p, 2.1, 0.3, 9.35, 2.6, 0.78, 9.75);   // 水箱
        B(p, 2.1, 0, 8.75, 2.6, 0.42, 9.4);      // 座
    });
    }
    // 绿植（东南角）+ 浴室垫
    add('PLANT_pot', 'MAT_pot', (p) => B(p, 3.3, 0, 0.3, 3.7, 0.4, 0.7), { nav_ignore: true });
    add('PLANT_leaves', 'MAT_plant', (p) => B(p, 3.35, 0.4, 0.35, 3.65, 0.95, 0.65), { nav_ignore: true });
    add('RUG', 'MAT_rug', (p) => B(p, -0.55, 0.02, 2.8, 0.55, 0.035, 4.0), { nav_ignore: true });

    // 顶灯
    add('LAMP', 'MAT_lamp', (p) => B(p, -0.22, H - 0.18, D / 2 - 0.22, 0.22, H - 0.02, D / 2 + 0.22),
        { nav_ignore: true });

    doorS(add, 'DOOR_corridor', 0, { scene: 'f1_corridor', spawn: 'fromBath' });

    return parts;
}

// ════════════════════════════════════════════════════════════
//  厨房（东翼 10×12×4.5，和客厅一样大）：南墙大门+2 拱窗（W11/W13 F1），
//  北墙 3 拱窗（W4），+x 墙门→走廊（进门面窗左手边），
//  **-x 墙悬空楼梯**（右手边；17 步→平台→顶部门洞触发传送学习室，
//  触发区在 config.js f1_kitchen.triggers）
// ════════════════════════════════════════════════════════════
function buildKitchen() {
    const W = 10, D = 12, H = 4.5, xw = W / 2;
    const N_WIN = { centers: [-1.4, -0.45, 0.5], width: 0.87, y0: 0.55, y1: 2.45 };
    const N_WIN_X = N_WIN.centers.map((c) => [c - N_WIN.width / 2, c + N_WIN.width / 2]);
    const S_WIN = { centers: [-2.8, 2.8], width: 0.87, y0: 0.55, y1: 2.45 };
    const S_WIN_X = S_WIN.centers.map((c) => [c - S_WIN.width / 2, c + S_WIN.width / 2]);
    const W_DOOR = 2.2;   // 西墙门中心 z（→ 走廊）
    const { parts, add, B } = roomBuilder();

    add('FLOOR_visible', 'MAT_floor_tile', (p) => B(p, -xw, -0.06, 0, xw, 0, D));
    walkFloorWithStairs(add, W, D, 'MAT_floor_tile', -1);

    add('WALLS', 'MAT_wall_interior', (p) => {
        pushWallX(p, -WT, 0, -xw, xw, H, [
            { a0: -DOOR_W / 2, a1: DOOR_W / 2, y0: 0, y1: DOOR_H },
            ...S_WIN_X.map(([a0, a1]) => ({ a0, a1, y0: S_WIN.y0, y1: S_WIN.y1, arch: true })),
        ]);
        // 北墙：3 拱窗 + 井道 footprint 处平台层以上开豁口（-x 段，楼梯在 -x 墙）
        pushWallX(p, D, D + WT, -xw, xw, H, [
            ...N_WIN_X.map(([a0, a1]) => ({ a0, a1, y0: N_WIN.y0, y1: N_WIN.y1, arch: true })),
            { a0: -xw, a1: -SHAFT.x0, y0: ST.top, y1: H },
        ]);
        // -x 墙（楼梯侧）：井道段（z ≥ SHAFT.z0）只砌到平台层，上面由井道外墙接住
        pushBox(p, [-xw - WT, 0, -WT], [-xw, H, SHAFT.z0]);
        pushBox(p, [-xw - WT, 0, SHAFT.z0], [-xw, ST.top, D + WT]);
        // +x 墙：走廊门洞（z 1.7..2.7，进门面窗左手边），实心到顶
        pushWallZ(p, xw, xw + WT, -WT, D + WT, H,
            [{ a0: W_DOOR - DOOR_W / 2, a1: W_DOOR + DOOR_W / 2, y0: 0, y1: DOOR_H }]);
    });

    // 天花板（楼梯上段上方开井口——-x 段，井口向上接挑高井道）
    add('CEILING', 'MAT_ceiling_interior', (p) => {
        pushBox(p, [-xw - WT, H, -WT], [xw + WT, H + 0.12, HOLE.z0]);
        pushBox(p, [-HOLE.x0, H, HOLE.z0], [xw + WT, H + 0.12, D + WT]);
    });

    buildStairs(add, D, -1);

    add('FRAMES', 'MAT_frame', (p) => {
        frameX(p, 0, 0, 1);                                   // 南墙大门
        frameZ(p, W_DOOR, xw, -1);                            // +x 墙走廊门
        for (const [x0, x1] of N_WIN_X) winFrame(p, x0, x1, N_WIN.y0, N_WIN.y1, D, 1);
        for (const [x0, x1] of S_WIN_X) winFrame(p, x0, x1, S_WIN.y0, S_WIN.y1, 0, -1);
    });

    add('VIEW_window', 'MAT_window_view', (p) =>
        pushBox(p, [N_WIN_X[0][0] - 0.4, N_WIN.y0 - 0.25, D + 0.4],
                   [N_WIN_X[N_WIN_X.length - 1][1] + 0.4, N_WIN.y1 + 0.25, D + 0.46]),
        { nav_ignore: true });
    add('VIEW_window_s', 'MAT_window_view', (p) =>
        pushBox(p, [S_WIN_X[0][0] - 0.4, S_WIN.y0 - 0.25, -0.46],
                   [S_WIN_X[S_WIN_X.length - 1][1] + 0.4, S_WIN.y1 + 0.25, -0.40]),
        { nav_ignore: true });

    // 家具（台面/灶台/水槽/冰箱/中岛/吧凳/餐桌椅）暂时撤掉，见 WITH_FURNITURE
    if (WITH_FURNITURE) {
    // 北墙台面（避开窗洞 x -1.835..0.935 与楼梯带 x≤-3.85）：灶台 + 水槽
    add('FURN_counter', 'MAT_counter', (p) => B(p, 1.1, 0, 11.1, 2.9, 0.9, 11.9));
    add('FURN_stove', 'MAT_fridge', (p) => B(p, 1.35, 0.9, 11.35, 1.95, 0.98, 11.7));
    add('FURN_sink', 'MAT_fixture', (p) => B(p, 2.3, 0.9, 11.35, 2.75, 0.94, 11.7));
    // 冰箱（台面 +x 端，楼梯带在 x≤-3.85 不冲突）
    add('FURN_fridge', 'MAT_fridge', (p) => B(p, 3.0, 0, 11.0, 3.7, 1.9, 11.85));
    // 中岛台 + 两个吧凳
    add('FURN_island', 'MAT_furniture', (p) => B(p, -2.3, 0, 5.3, -0.9, 0.9, 6.7));
    add('FURN_stools', 'MAT_furniture', (p) => {
        B(p, -2.15, 0, 4.65, -1.75, 0.55, 5.05);
        B(p, -1.35, 0, 4.65, -0.95, 0.55, 5.05);
    });
    // 餐桌（南窗区，避开 +x 墙门摆动区 x≥4 z1.7..2.7）+ 四椅
    add('FURN_table', 'MAT_furniture', (p) => {
        B(p, -1.3, 0.68, 2.9, 0.7, 0.76, 4.5);
        for (const [lx, lz] of [[-1.24, 2.96], [0.58, 2.96], [-1.24, 4.38], [0.58, 4.38]])
            B(p, lx, 0, lz, lx + 0.06, 0.68, lz + 0.06);
    });
    add('FURN_chairs', 'MAT_furniture', (p) => {
        for (const [cx, cz] of [[-1.9, 3.3], [-1.9, 4.1], [1.05, 3.3], [1.05, 4.1]]) {
            B(p, cx - 0.2, 0, cz - 0.2, cx + 0.2, 0.45, cz + 0.2);   // 座面
            // 靠背在远离桌子一侧（西排朝西，东排朝东）
            const bx0 = cx < 0 ? cx - 0.26 : cx + 0.14;
            B(p, bx0, 0.45, cz - 0.2, bx0 + 0.12, 0.95, cz + 0.2);
        }
    });
    }
    // 绿植（东南角，避开南门摆动区 x±0.5）
    add('PLANT_pot', 'MAT_pot', (p) => B(p, 1.6, 0, 0.35, 2.0, 0.4, 0.75), { nav_ignore: true });
    add('PLANT_leaves', 'MAT_plant', (p) => B(p, 1.65, 0.4, 0.4, 1.95, 0.95, 0.7), { nav_ignore: true });

    doorS(add, 'DOOR_outdoor', 0, { scene: 'outdoor', spawn: 'houseEast' });
    doorE(add, 'DOOR_corridor', xw, W_DOOR, { scene: 'f1_corridor', spawn: 'fromKitchen' });

    return parts;
}

// ── 材质表（每房一份；结构色取 room_palette.mjs）──
const MATS = {
    living: {
        MAT_wall_interior: '#B4C7CE',       // 雾霾蓝（2026-09-10 选定）
        MAT_ceiling_interior: '#B7D6E8',    // 浅蓝
        MAT_floor_wood: PALETTE.floorWood,
        MAT_frame: PALETTE.frame,
        MAT_door: PALETTE.door,
        MAT_window_view: PALETTE.windowView,
        MAT_curtain: '#E9E0C9',             // 亚麻米白
        // 楼梯（东墙）
        MAT_stairs: '#C09A6B',              // WALK 逻辑面（隐藏）
        MAT_tread: '#8A5A3B',               // 悬臂踏步板 + 平台面（inkwash wood 变体）
        MAT_railing: '#6E4B32',             // 西缘细栏杆（inkwash wood 变体）
        MAT_stairwell: '#14100C',           // 顶部门洞暗龛
    },
    corridor: {
        MAT_wall_interior: '#9DB4C0',       // 比客厅深一档的蓝灰（走廊显深邃）
        MAT_ceiling_interior: '#B7D6E8',
        MAT_floor_wood: PALETTE.floorWood,
        MAT_frame: PALETTE.frame,
        MAT_door: PALETTE.door,
        MAT_window_view: PALETTE.windowView,
        MAT_wainscot: '#6E4B32',            // 深木护墙板
        MAT_lamp: PALETTE.lamp,
        MAT_rug: '#9E5648',                 // 长毯：暗砖红
    },
    bath: {
        MAT_wall_interior: '#D8E4E8',       // 浅蓝白（浴室）
        MAT_ceiling_interior: '#B7D6E8',
        MAT_floor_tile: PALETTE.floorTile,
        MAT_frame: PALETTE.frame,
        MAT_door: PALETTE.door,
        MAT_window_view: PALETTE.windowView,
        MAT_fixture: '#F4F4F0',
        MAT_mirror: '#B8D8E8',
        MAT_pot: '#B0764A', MAT_plant: '#5E8C5A',
        MAT_rug: '#9AB8C8',
        MAT_lamp: PALETTE.lamp,
    },
    kitchen: {
        MAT_wall_interior: '#F0E6D0',       // 暖米（厨房，与客厅雾霾蓝冷暖对照）
        MAT_ceiling_interior: '#B7D6E8',
        MAT_floor_tile: PALETTE.floorTile,
        MAT_frame: PALETTE.frame,
        MAT_door: PALETTE.door,
        MAT_window_view: PALETTE.windowView,
        MAT_counter: '#8C9AA5', MAT_fridge: '#D8E0E4', MAT_fixture: '#F4F4F0',
        MAT_furniture: '#A9744F',
        MAT_pot: '#B0764A', MAT_plant: '#5E8C5A',
        // 楼梯（东墙，与客厅同一套）
        MAT_stairs: '#C09A6B',              // WALK 逻辑面（隐藏）
        MAT_tread: '#8A5A3B',               // 悬臂踏步板 + 平台面（inkwash wood 变体）
        MAT_railing: '#6E4B32',             // 西缘细栏杆（inkwash wood 变体）
        MAT_stairwell: '#14100C',           // 顶部门洞暗龛
    },
};

// ── 写 GLB ──
function writeGlb(out, parts, mats) {
    const matNames = Object.keys(mats);
    const gltf = {
        asset: { version: '2.0', generator: 'make_f1_suite.mjs' },
        scene: 0,
        scenes: [{ nodes: [] }],
        nodes: [],
        meshes: [],
        materials: matNames.map((name) => ({
            name,
            pbrMetallicRoughness: {
                baseColorFactor: hexToLinear(mats[name]),
                roughnessFactor: 1.0,
                metallicFactor: 0.0,
            },
        })),
        accessors: [],
        bufferViews: [],
        buffers: [{ byteLength: 0 }],
    };

    let bin = Buffer.alloc(0);
    function appendBuf(buf) {
        const offset = bin.length;
        bin = Buffer.concat([bin, buf]);
        gltf.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: buf.length });
        return gltf.bufferViews.length - 1;
    }

    for (const { name, mat, extras, translation, part } of parts) {
        const vbuf = Buffer.alloc(part.verts.length * 4);
        part.verts.forEach((v, i) => vbuf.writeFloatLE(v, i * 4));
        const nbuf = Buffer.alloc(part.norms.length * 4);
        part.norms.forEach((v, i) => nbuf.writeFloatLE(v, i * 4));
        const ibuf = Buffer.alloc(part.idx.length * 2);
        part.idx.forEach((v, i) => ibuf.writeUInt16LE(v, i * 2));
        if (part.verts.length / 3 > 65535) throw new Error(`${name} 顶点超 uint16 上限`);

        const mins = [0, 1, 2].map((k) => Math.min(...part.verts.filter((_, i) => i % 3 === k)));
        const maxs = [0, 1, 2].map((k) => Math.max(...part.verts.filter((_, i) => i % 3 === k)));
        const acBase = gltf.accessors.length;
        gltf.accessors.push(
            { bufferView: appendBuf(vbuf), componentType: 5126, count: part.verts.length / 3, type: 'VEC3', min: mins, max: maxs },
            { bufferView: appendBuf(nbuf), componentType: 5126, count: part.norms.length / 3, type: 'VEC3' },
            { bufferView: appendBuf(ibuf), componentType: 5123, count: part.idx.length, type: 'SCALAR' },
        );
        const mi = matNames.indexOf(mat);
        if (mi < 0) throw new Error(`${out}: 节点 ${name} 用了未登记的材质 ${mat}`);
        gltf.meshes.push({
            primitives: [{
                attributes: { POSITION: acBase, NORMAL: acBase + 1 },
                indices: acBase + 2,
                material: mi,
            }],
        });
        const node = { name, mesh: gltf.meshes.length - 1 };
        if (extras) node.extras = extras;
        if (translation) node.translation = translation;
        gltf.nodes.push(node);
        gltf.scenes[0].nodes.push(gltf.nodes.length - 1);
    }

    gltf.buffers[0].byteLength = bin.length;

    let json = Buffer.from(JSON.stringify(gltf), 'utf-8');
    const jsonPad = (4 - (json.length % 4)) % 4;
    if (jsonPad) json = Buffer.concat([json, Buffer.alloc(jsonPad, 0x20)]);
    const binPad = (4 - (bin.length % 4)) % 4;
    if (binPad) bin = Buffer.concat([bin, Buffer.alloc(binPad)]);
    const head = Buffer.alloc(12);
    head.writeUInt32LE(0x46546C67, 0);
    head.writeUInt32LE(2, 4);
    head.writeUInt32LE(12 + 8 + json.length + 8 + bin.length, 8);
    const jh = Buffer.alloc(8);
    jh.writeUInt32LE(json.length, 0);
    jh.writeUInt32LE(0x4E4F534A, 4);
    const bh = Buffer.alloc(8);
    bh.writeUInt32LE(bin.length, 0);
    bh.writeUInt32LE(0x004E4942, 4);
    writeFileSync(out, Buffer.concat([head, jh, json, bh, bin]));
}

// ── 主流程 ──
const OUT = {
    living: 'models/room_living.glb',
    corridor: 'models/room_corridor.glb',
    bath: 'models/room_bath_f1.glb',
    kitchen: 'models/room_kitchen.glb',
};
const BUILDERS = { living: buildLiving, corridor: buildCorridor, bath: buildBath, kitchen: buildKitchen };
for (const [key, build] of Object.entries(BUILDERS)) {
    const parts = build();
    writeGlb(OUT[key], parts, MATS[key]);
    console.log(`${OUT[key]}: ${parts.length} 节点 — ${parts.map((p) => p.name).join(', ')}`);
}
console.log('\n一楼 4 房间已生成');
