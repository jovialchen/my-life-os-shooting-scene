/** 三楼（阁楼层）房间生成器（6 间，纯 Node 写 GLB，无需 Blender）
 *
 * 一楼 4 房（客厅/走廊/客卫/厨房）已移交 tools/make_f1_suite.mjs（2026-09-10
 * 一楼改版：大厅×2 + 走廊 + 大客卫 + 厨房东墙楼梯）；
 * 二楼 4 房（卧室1/卧室2/F2走廊/F2厕所）2026-09-23 起也移交 make_f1_suite.mjs
 * （二楼重排：卧室需要悬空梯基建，取消 f2_study/f2_bed3/f2_bath1-3）。
 * 2026-09-23 三楼重写：取消旧阁楼 2 游戏室（attic_game_a/b），改为与一二楼
 * 同结构的 6 房 + 人字坡顶（屋脊沿 z，山墙=南/北墙）：
 *   西翼 卧室A 10×12（eave2.2/ridge4.5，镜像 f2_bed1 布局但无上行梯；
 *        北墙=山墙：下楼门 x4.0..5.0 → f2_bed1 上行梯平台 + W14 三联拱窗偏左）
 *   东翼 卧室B 10×12（镜像；W15 三联拱窗偏右，下楼门 → f2_bed2 平台）
 *   卧室A 南 游戏室 7×7（eave1.6/ridge3.2，无窗顶灯；北门 ↔ 卧室A 南门）
 *   卧室B 南 学习室 7×7（同游戏室结构，色系沿用旧 game_b）
 *   中厅 走廊 3×12（eave2.4/ridge3.1，无窗吊灯；西/东墙门 z2.2 ↔ 卧室A/B，
 *        北尽头门 → 厕所）
 *   中厅北 厕所 8×10（eave2.2/ridge4.0，无窗；南门 ↔ 走廊）
 *
 * 规范同 tools/make_f1_suite.mjs（一楼套房）：
 *   - 原点在主门（doors[0]，一律南墙 z=0 居中）门口地板中心；x±w/2，z 0..d
 *   - 门支持南(S)/北(N)墙（门板沿 x；S dir=left 开向屋内 +z，N dir=right 开向 -z）
 *     与西(W=-x)/东(E=+x)墙（门板沿 z，off=z 中心；W dir=right 开向 +x，E dir=left 开向 -x）
 *   - 门 extras: door_target_scene / door_target_spawn（传送目标，双向门必须配对）
 *   - 窗只开在南/北墙；窗景片 MAT_window_view 标 nav_ignore（时间系统按名联动变色）
 *   - 家具不标属性（自动障碍）；地毯/盆栽等纯装饰标 nav_ignore
 *
 * 用法: node tools/make_rooms.mjs
 *   → models/room_bed_a.glb / room_bed_b.glb / room_game.glb / room_study.glb
 *     / room_corridor_attic.glb / room_bath_attic.glb
 */
import { writeFileSync } from 'node:fs';
import { PALETTE, BASE_MATS } from './room_palette.mjs';

const WT = 0.1;          // 墙厚
const DOOR_W = 1.0, DOOR_H = 2.1;

// ── 材质工具 ──
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
    [[0, 1, 0], [[0, 0, 0], [0, 0, 1], [1, 0, 1], [1, 0, 0]]],
    [[0, -1, 0], [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]]],
    [[0, 0, 1], [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]]],
    [[0, 0, -1], [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]]],
];

const makePart = () => ({ verts: [], norms: [], idx: [] });

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

/** 任意四边形（法线由叉积算；back=true 时反向再出一面 = 双面） */
function pushQuad(part, corners, back = false) {
    const [a, b, c, d] = corners;
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const len = Math.hypot(...n) || 1;
    n = n.map((x) => x / len);
    const emit = (cs, nn) => {
        const b0 = part.verts.length / 3;
        for (const p of cs) { part.verts.push(...p); part.norms.push(...nn); }
        part.idx.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3);
    };
    emit(corners, n);
    if (back) emit([...corners].reverse(), n.map((x) => -x));
}

/** 洞口在高度 y 处的开口区间（拱窗按收缩级取宽） */
function openingAt(hole, y) {
    const cx = (hole.a0 + hole.a1) / 2, w = hole.a1 - hole.a0;
    if (!hole.arch || y <= hole.y1 - 0.3) return [hole.a0, hole.a1];
    if (y <= hole.y1 - 0.15) return [cx - w * 0.35, cx + w * 0.35];
    return [cx - w * 0.175, cx + w * 0.175];
}

/** 山墙（人字坡两端的三角墙，沿 x 方向）：矩形段 0..eave + 扫描线切片三角段
 *  洞口（门/拱窗）可从矩形段延续进三角段（阁楼门 2.1m 高过檐口） */
function pushGableWallX(part, z0, z1, x0, x1, eave, ridge, holes) {
    pushWallX(part, z0, z1, x0, x1, eave,
        holes.map((h) => ({ ...h, y1: Math.min(h.y1, eave), arch: false })));
    const DY = 0.2;
    for (let yA = eave; yA < ridge - 0.001; yA += DY) {
        const yB = Math.min(yA + DY, ridge);
        const yM = (yA + yB) / 2;
        const hw = x1 * (ridge - yM) / (ridge - eave);   // 该高度带的半宽
        if (hw < 0.02) continue;
        const opens = holes
            .filter((h) => yB > h.y0 + 0.001 && yA < h.y1 - 0.001)
            .map((h) => openingAt(h, yM))
            .sort((a, b) => a[0] - b[0]);
        let cur = -hw;
        for (const [o0, o1] of opens) {
            if (o0 - cur > 0.001) pushBox(part, [cur, yA, z0], [o0, yB, z1]);
            cur = Math.max(cur, o1);
        }
        if (hw - cur > 0.001) pushBox(part, [cur, yA, z0], [hw, yB, z1]);
    }
}
/** 带洞口的墙（沿 x 方向，洞在 y0..y1、a0..a1 区间掏空）
 *  hole.arch=true 时洞顶为台阶拱：起拱线 y1-0.3，两级收缩 ×0.7/×0.35
 * （各 0.15 高）——与外壳 WINDOW_01 的台阶拱同一语汇（doc/house-map.md） */
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

/** 带洞口的墙（沿 z 方向，洞口为矩形——门洞用；西/东墙） */
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

// ── 房间规格 ──
// doors:  { name, wall:'S'|'N'|'W'|'E', off(沿墙中心偏移；W/E 墙为 z 中心), target:[scene,spawn] }
// windows:{ wall:'S'|'N', centers:[窗中心x..], width, y0, y1, arch }（只开南/北墙）
//   窗位/数量/宽度对应外壳实测（doc/house-map.md 对应表）；arch=台阶拱窗
// gable:  { eave, ridge } 人字坡顶（屋脊沿 z，山墙=南/北墙）；缺省平顶
//   坡率沿用旧阁楼 ≈0.457/m（eave1.6→ridge3.2 跨 3.5m）
// lampY:  吊灯盒体顶面高度（缺省 = h；坡顶房挂在屋脊下方）
// furnish(add, B): B(x0,y0,z0,x1,y1,z1) 便捷盒体
// 结构色统一取 tools/room_palette.mjs（PALETTE / BASE_MATS 已导入）
const ROOMS = [
    // ── 卧室A（西翼 10×12，坡顶 eave2.2/ridge4.5）：镜像 f2_bed1 布局但无上行梯。
    //    北墙=山墙：下楼门 x4.0..5.0（→ f2_bed1 上行梯平台，y2.1<eave 留在矩形段）
    //    + W14 三联拱窗（sill1.1/顶2.9，组偏左 -2.9/-1.95/-1.0 避让门洞，拱顶进山墙三角段）；
    //    南门 → 游戏室；-x 墙 z2.2 门 → 阁楼走廊 ──
    {
        id: 'attic_bed_a', file: 'models/room_bed_a.glb',
        w: 10, d: 12, h: 4.5,
        gable: { eave: 2.2, ridge: 4.5 },
        lampY: 3.4,
        mats: {
            MAT_wall: '#F2E4E0',            // 淡粉（同 f2_bed1）
            MAT_floor: PALETTE.floorWood,
            MAT_bed: '#D98E6A', MAT_furniture: '#A9744F', MAT_rug: '#C96F5A',
        },
        doors: [
            { name: 'DOOR_stairs_down', wall: 'N', off: 4.5, target: ['f2_bed1', 'fromAtticA'] },
            { name: 'DOOR_game', wall: 'S', off: 0, target: ['attic_game', 'default'] },
            { name: 'DOOR_corridor', wall: 'W', off: 2.2, target: ['attic_corridor', 'fromBedA'] },
        ],
        windows: [{ wall: 'N', centers: [-2.9, -1.95, -1.0], width: 0.87, y0: 1.1, y1: 2.9, arch: true }],
        furnish(add, B) {
            // 床靠西墙北段（让开西墙门摆动区 z1.7..2.7）
            add('FURN_bed', 'MAT_bed', (p) => {
                B(p, -4.95, 0, 5.6, -3.5, 0.5, 7.4);
                B(p, -4.95, 0.5, 5.75, -3.5, 0.58, 7.25);
            });
            add('FURN_headboard', 'MAT_furniture', (p) => B(p, -4.95, 0, 7.4, -3.5, 1.05, 7.52));
            // 衣柜靠东墙南段（让开北墙下楼门 x4.0..5.0 摆动区 z11..12）
            add('FURN_wardrobe', 'MAT_furniture', (p) => B(p, 4.3, 0, 1.2, 4.95, 2.0, 2.4));
            add('RUG', 'MAT_rug', (p) => B(p, -1.8, 0.02, 4.0, 0.6, 0.035, 6.4), { nav_ignore: true });
        },
    },
    // ── 卧室B（东翼镜像）：W15 三联拱窗偏右 +1.0/+1.95/+2.9，下楼门 x-5..-4 →
    //    f2_bed2 平台；南门 → 学习室；+x 墙 z2.2 门 → 阁楼走廊 ──
    {
        id: 'attic_bed_b', file: 'models/room_bed_b.glb',
        w: 10, d: 12, h: 4.5,
        gable: { eave: 2.2, ridge: 4.5 },
        lampY: 3.4,
        mats: {
            MAT_wall: '#E0E8F2',            // 淡蓝（同 f2_bed2）
            MAT_floor: PALETTE.floorWood,
            MAT_bed: '#7A9EC9', MAT_furniture: '#A9744F', MAT_rug: '#6A8CB8',
        },
        doors: [
            { name: 'DOOR_stairs_down', wall: 'N', off: -4.5, target: ['f2_bed2', 'fromAtticB'] },
            { name: 'DOOR_study', wall: 'S', off: 0, target: ['attic_study', 'default'] },
            { name: 'DOOR_corridor', wall: 'E', off: 2.2, target: ['attic_corridor', 'fromBedB'] },
        ],
        windows: [{ wall: 'N', centers: [1.0, 1.95, 2.9], width: 0.87, y0: 1.1, y1: 2.9, arch: true }],
        furnish(add, B) {
            add('FURN_bed', 'MAT_bed', (p) => {
                B(p, 3.5, 0, 5.6, 4.95, 0.5, 7.4);
                B(p, 3.5, 0.5, 5.75, 4.95, 0.58, 7.25);
            });
            add('FURN_headboard', 'MAT_furniture', (p) => B(p, 3.5, 0, 7.4, 4.95, 1.05, 7.52));
            add('FURN_wardrobe', 'MAT_furniture', (p) => B(p, -4.95, 0, 1.2, -4.3, 2.0, 2.4));
            add('RUG', 'MAT_rug', (p) => B(p, -0.6, 0.02, 4.0, 1.8, 0.035, 6.4), { nav_ignore: true });
        },
    },
    // ── 游戏室（卧室A 南，7×7，eave1.6/ridge3.2 沿用旧阁楼坡率）：唯一门在北墙
    //    （↔ 卧室A 南门，2.1m 高过檐口、伸进山墙三角段）；无窗顶灯（winless）──
    {
        id: 'attic_game', file: 'models/room_game.glb',
        w: 7, d: 7, h: 3.2,
        gable: { eave: 1.6, ridge: 3.2 },
        lampY: 2.6,
        mats: {
            MAT_wall: '#E0D8E8', MAT_floor: PALETTE.floorWood,
            MAT_furniture: '#8A6A4A', MAT_tv: '#2B2B33',
            MAT_sofa: '#B87AB8', MAT_rug: '#8A6AC9',
        },
        doors: [
            { name: 'DOOR_bed_a', wall: 'N', off: 0, target: ['attic_bed_a', 'fromGame'] },
        ],
        windows: [],
        furnish(add, B) {
            // 电视柜 + 电视（东墙，避开北门摆动区 x±0.5 z6..7）
            add('FURN_tvstand', 'MAT_furniture', (p) => B(p, 3.0, 0, 3.9, 3.45, 0.5, 4.4));
            add('FURN_tv', 'MAT_tv', (p) => B(p, 3.05, 0.5, 3.95, 3.4, 1.35, 4.35));
            // 懒人沙发朝电视
            add('FURN_sofa', 'MAT_sofa', (p) => {
                B(p, 1.4, 0, 3.8, 2.4, 0.42, 4.7);
                B(p, 1.4, 0.42, 3.8, 1.6, 0.7, 4.7);
            });
            // 西墙游戏架
            add('FURN_shelf', 'MAT_furniture', (p) => {
                B(p, -3.45, 0, 2.5, -3.1, 1.6, 4.9);
                B(p, -3.48, 0.7, 2.55, -3.1, 0.76, 4.85);
            });
            add('RUG', 'MAT_rug', (p) => B(p, -1.9, 0.02, 2.0, 0.5, 0.035, 4.2), { nav_ignore: true });
        },
    },
    // ── 学习室（卧室B 南，7×7 同游戏室结构；色系沿用旧 game_b 暖色组）──
    {
        id: 'attic_study', file: 'models/room_study.glb',
        w: 7, d: 7, h: 3.2,
        gable: { eave: 1.6, ridge: 3.2 },
        lampY: 2.6,
        mats: {
            MAT_wall: '#E8DCD0', MAT_floor: PALETTE.floorWood,
            MAT_furniture: '#8A6A4A', MAT_chest: '#C9A44A', MAT_rug: '#C98A5A',
        },
        doors: [
            { name: 'DOOR_bed_b', wall: 'N', off: 0, target: ['attic_bed_b', 'fromStudy'] },
        ],
        windows: [],
        furnish(add, B) {
            // 书桌 + 椅（东墙，避开北门摆动区 x±0.5 z6..7）
            add('FURN_desk', 'MAT_furniture', (p) => {
                B(p, 2.2, 0.68, 4.6, 3.4, 0.76, 5.4);
                for (const [lx, lz] of [[2.26, 4.66], [3.28, 4.66], [2.26, 5.28], [3.28, 5.28]])
                    B(p, lx, 0, lz, lx + 0.06, 0.68, lz + 0.06);
            });
            add('FURN_chair', 'MAT_furniture', (p) => {
                B(p, 2.6, 0, 3.9, 3.0, 0.45, 4.3);        // 座面
                B(p, 2.6, 0.45, 3.9, 3.0, 0.95, 4.02);   // 靠背（南面，朝桌）
            });
            // 书柜（西墙）+ 储物箱（西北角）
            add('FURN_shelf', 'MAT_furniture', (p) => {
                B(p, -3.45, 0, 2.5, -3.1, 1.6, 4.9);
                B(p, -3.48, 0.7, 2.55, -3.1, 0.76, 4.85);
            });
            add('FURN_chest', 'MAT_chest', (p) => B(p, -3.4, 0, 5.8, -2.7, 0.6, 6.5));
            add('RUG', 'MAT_rug', (p) => B(p, -1.2, 0.02, 1.8, 0.8, 0.035, 3.8), { nav_ignore: true });
        },
    },
    // ── 阁楼走廊（中厅 3×12，与一二楼走廊同位同尺寸，eave2.4/ridge3.1）：
    //    西/东墙 z2.2 门 ↔ 卧室A/B，北尽头门 → 厕所；无窗（阁楼中厅无外壳窗），
    //    吊灯照明；护墙板 + 长地毯（同一二楼走廊语汇）──
    {
        id: 'attic_corridor', file: 'models/room_corridor_attic.glb',
        w: 3, d: 12, h: 3.1,
        gable: { eave: 2.4, ridge: 3.1 },
        lampY: 2.7,
        mats: {
            MAT_wall: '#9DB4C0',            // 蓝灰（同一二楼走廊，显深邃）
            MAT_floor: PALETTE.floorWood,
            MAT_wainscot: '#6E4B32', MAT_rug: '#9E5648',
        },
        doors: [
            { name: 'DOOR_bed_a', wall: 'W', off: 2.2, target: ['attic_bed_a', 'fromCorridor'] },
            { name: 'DOOR_bed_b', wall: 'E', off: 2.2, target: ['attic_bed_b', 'fromCorridor'] },
            { name: 'DOOR_bath', wall: 'N', off: 0, target: ['attic_bath', 'default'] },
        ],
        windows: [],
        furnish(add, B) {
            // 护墙板（西/东长墙，高 0.95 + 顶线；门洞 z1.66..2.78 处断开）
            add('WAINSCOT', 'MAT_wainscot', (p) => {
                for (const s of [-1, 1]) {
                    const x0 = s < 0 ? -1.5 : 1.47, x1 = s < 0 ? -1.47 : 1.5;
                    for (const [z0, z1] of [[0.02, 1.66], [2.78, 11.98]]) {
                        B(p, x0, 0, z0, x1, 0.95, z1);
                        B(p, x0 - (s < 0 ? 0 : 0.005), 0.95, z0, x1 + (s < 0 ? 0.005 : 0), 1.02, z1);
                    }
                }
            });
            add('RUG', 'MAT_rug', (p) => B(p, -0.6, 0.02, 3.2, 0.6, 0.035, 10.8), { nav_ignore: true });
        },
    },
    // ── 阁楼厕所（中厅北 8×10，eave2.2/ridge4.0）：南墙门 ↔ 走廊；无窗，
    //    顶灯补偿（config winless，min 0.8 参照 f2_bath）──
    {
        id: 'attic_bath', file: 'models/room_bath_attic.glb',
        w: 8, d: 10, h: 4.0,
        gable: { eave: 2.2, ridge: 4.0 },
        lampY: 3.0,
        mats: {
            MAT_wall: '#D8E4E8',            // 浅蓝白（浴室，同一二楼）
            MAT_floor: PALETTE.floorTile,
            MAT_rug: '#9AB8C8',
        },
        doors: [
            { name: 'DOOR_corridor', wall: 'S', off: 0, target: ['attic_corridor', 'fromBath'] },
        ],
        windows: [],
        furnish(add, B) {
            add('RUG', 'MAT_rug', (p) => B(p, -0.55, 0.02, 2.8, 0.55, 0.035, 4.0), { nav_ignore: true });
        },
    },
];

// ── 房间装配 ──
function buildRoom(spec) {
    const { w, d, h } = spec;
    const xw = w / 2;
    const parts = [];
    function add(name, mat, build, extras = null, translation = null) {
        const part = makePart();
        build(part);
        parts.push({ name, mat, extras, translation, part });
    }
    const B = (p, x0, y0, z0, x1, y1, z1) => pushBox(p, [x0, y0, z0], [x1, y1, z1]);

    // 洞口表（南/北墙：门 + 窗，a 轴 = x；西/东墙：仅门，a 轴 = z）；窗 centers → ranges
    const winRanges = (wn) => wn.centers.map((c) => [c - wn.width / 2, c + wn.width / 2]);
    const holesFor = (wall) => [
        ...spec.doors.filter((dr) => dr.wall === wall)
            .map((dr) => ({ a0: dr.off - DOOR_W / 2, a1: dr.off + DOOR_W / 2, y0: 0, y1: DOOR_H })),
        ...(wall === 'S' || wall === 'N' ? spec.windows.filter((wn) => wn.wall === wall)
            .flatMap((wn) => winRanges(wn).map(([a0, a1]) => ({ a0, a1, y0: wn.y0, y1: wn.y1, arch: wn.arch }))) : []),
    ];
    // 洞口重叠检查（建模错误会产出碎墙；同墙门洞与窗洞一并查）
    for (const wall of ['S', 'N', 'W', 'E']) {
        const hs = holesFor(wall).sort((a, b) => a.a0 - b.a0);
        for (let i = 1; i < hs.length; i++) {
            if (hs[i].a0 < hs[i - 1].a1 - 0.001) {
                throw new Error(`${spec.id} ${wall}墙洞口重叠: ${JSON.stringify(hs)}`);
            }
        }
    }

    // 地板 + WALK 逻辑面 + 天花板（阁楼为人字坡顶：两片坡面，檐口 eave → 屋脊 ridge）
    const gb = spec.gable ?? null;
    add('FLOOR_visible', 'MAT_floor', (p) => B(p, -xw, -0.06, 0, xw, 0, d));
    add('WALK_floor', 'MAT_floor',
        (p) => pushQuadXZ(p, -xw + 0.05, 0.05, xw - 0.05, d - 0.05, 0.015),
        { surface_walkable: true });
    add('CEILING', 'MAT_wall', (p) => {
        if (!gb) {
            B(p, -xw - WT, h, -WT, xw + WT, h + 0.12, d + WT);
        } else {
            pushQuad(p, [[-xw - WT, gb.eave, -WT], [-xw - WT, gb.eave, d + WT],
                         [0, gb.ridge, d + WT], [0, gb.ridge, -WT]], true);
            pushQuad(p, [[xw + WT, gb.eave, -WT], [xw + WT, gb.eave, d + WT],
                         [0, gb.ridge, d + WT], [0, gb.ridge, -WT]], true);
        }
    });

    // 墙体：南(z=0)/北(z=d) 带洞（阁楼为山墙：矩形段+三角段），东/西到檐口（可带门洞）
    add('WALLS', 'MAT_wall', (p) => {
        const wallH = gb ? gb.eave : h;
        if (!gb) {
            pushWallX(p, -WT, 0, -xw, xw, h, holesFor('S'));
            pushWallX(p, d, d + WT, -xw, xw, h, holesFor('N'));
        } else {
            pushGableWallX(p, -WT, 0, -xw, xw, gb.eave, gb.ridge, holesFor('S'));
            pushGableWallX(p, d, d + WT, -xw, xw, gb.eave, gb.ridge, holesFor('N'));
        }
        const holesW = holesFor('W'), holesE = holesFor('E');
        if (holesW.length) pushWallZ(p, -xw - WT, -xw, -WT, d + WT, wallH, holesW);
        else B(p, -xw - WT, 0, -WT, -xw, wallH, d + WT);
        if (holesE.length) pushWallZ(p, xw, xw + WT, -WT, d + WT, wallH, holesE);
        else B(p, xw, 0, -WT, xw + WT, wallH, d + WT);
    });

    // 门框 + 窗框（十字棂 + 窗台板）
    add('FRAMES', 'MAT_frame', (p) => {
        const j = 0.06;
        for (const dr of spec.doors) {
            if (dr.wall === 'S' || dr.wall === 'N') {
                const z0 = dr.wall === 'S' ? -WT - 0.02 : d - 0.02;
                const z1 = dr.wall === 'S' ? 0.02 : d + WT + 0.02;
                const x0 = dr.off - DOOR_W / 2, x1 = dr.off + DOOR_W / 2;
                B(p, x0 - j, 0, z0, x0, DOOR_H + j, z1);
                B(p, x1, 0, z0, x1 + j, DOOR_H + j, z1);
                B(p, x0 - j, DOOR_H, z0, x1 + j, DOOR_H + j, z1);
            } else {
                // W/E 墙门框（同 make_f1_suite.mjs frameZ）：f=墙房内侧面 x，o=出房方向
                const f = dr.wall === 'W' ? -xw : xw;
                const o = dr.wall === 'W' ? 1 : -1;
                const x0 = Math.min(f - o * 0.02, f + o * (WT + 0.02));
                const x1 = Math.max(f - o * 0.02, f + o * (WT + 0.02));
                const z0 = dr.off - DOOR_W / 2, z1 = dr.off + DOOR_W / 2;
                B(p, x0, 0, z0 - j, x1, DOOR_H + j, z0);
                B(p, x0, 0, z1, x1, DOOR_H + j, z1 + j);
                B(p, x0, DOOR_H, z0 - j, x1, DOOR_H + j, z1 + j);
            }
        }
        for (const wn of spec.windows) {
            const z0 = wn.wall === 'S' ? -WT - 0.03 : d - 0.03;
            const z1 = wn.wall === 'S' ? 0.03 : d + WT + 0.03;
            const zw0 = wn.wall === 'S' ? -WT : d;
            const zw1 = wn.wall === 'S' ? 0 : d + WT;
            for (const [x0, x1] of winRanges(wn)) {
                const ys = wn.arch ? wn.y1 - 0.3 : wn.y1;   // 起拱线（矩形段顶）
                B(p, x0 - j, wn.y0 - j, z0, x0, ys + j, z1);
                B(p, x1, wn.y0 - j, z0, x1 + j, ys + j, z1);
                B(p, x0 - j - 0.02, wn.y0 - j - 0.04, Math.min(z0, z1) - 0.01, x1 + j + 0.02, wn.y0, Math.max(z0, z1));
                const cx = (x0 + x1) / 2, cy = (wn.y0 + ys) / 2, m = 0.02;
                B(p, cx - m, wn.y0, zw0, cx + m, ys, zw1);    // 竖棂（矩形段）
                B(p, x0, cy - m, zw0, x1, cy + m, zw1);       // 横棂
                if (wn.arch) {
                    // 拱顶框：起拱线横梁 + 两级踏步边梃 + 顶梁
                    const w = x1 - x0;
                    B(p, x0 - j, ys, z0, x1 + j, ys + j, z1);
                    const hw1 = w * 0.7 / 2, hw2 = w * 0.35 / 2;
                    B(p, cx - hw1 - j, ys, z0, cx - hw1, ys + 0.15, z1);
                    B(p, cx + hw1, ys, z0, cx + hw1 + j, ys + 0.15, z1);
                    B(p, cx - hw2 - j, ys + 0.15, z0, cx - hw2, wn.y1, z1);
                    B(p, cx + hw2, ys + 0.15, z0, cx + hw2 + j, wn.y1, z1);
                    B(p, cx - hw2 - j, wn.y1, z0, cx + hw2 + j, wn.y1 + j, z1);
                } else {
                    B(p, x0 - j, wn.y1, z0, x1 + j, wn.y1 + j, z1);
                }
            }
        }
    });

    // 窗景片（每面有窗的墙一片，外侧 0.4m）
    for (const wn of spec.windows) {
        const ranges = winRanges(wn);
        const a0 = Math.min(...ranges.map((r) => r[0])) - 0.4;
        const a1 = Math.max(...ranges.map((r) => r[1])) + 0.4;
        const [z0, z1] = wn.wall === 'S' ? [-0.46, -0.4] : [d + 0.4, d + 0.46];
        add(`VIEW_window_${wn.wall}`, 'MAT_window_view',
            (p) => B(p, a0, wn.y0 - 0.25, z0, a1, wn.y1 + 0.25, z1),
            { nav_ignore: true });
    }

    // 门板（origin 在铰链底边；S 开向 +z dir=left，N 开向 -z dir=right，
    // W 开向 +x dir=right，E 开向 -x dir=left——同 make_f1_suite.mjs doorS/N/W/E）
    for (const dr of spec.doors) {
        const dir = { S: 'left', N: 'right', W: 'right', E: 'left' }[dr.wall];
        const extras = {
            interactable_type: 'door',
            door_swing_angle: 90.0,
            door_swing_dir: dir,
            door_slide: false,
            door_locked: false,
            door_target_scene: dr.target[0],
            door_target_spawn: dr.target[1],
        };
        if (dr.wall === 'S' || dr.wall === 'N') {
            add(dr.name, 'MAT_door', (p) => B(p, 0, 0, -0.02, 0.96, 2.06, 0.02),
                extras, [dr.off - 0.48, 0.02, dr.wall === 'S' ? 0 : d]);
        } else {
            add(dr.name, 'MAT_door', (p) => B(p, -0.02, 0, 0, 0.02, 2.06, 0.96),
                extras, [dr.wall === 'W' ? -xw : xw, 0.02, dr.off - 0.48]);
        }
    }

    // 吊灯（装饰，nav_ignore；PointLight 位姿在 config 场景光照里）
    const lampY = spec.lampY ?? h;
    add('LAMP', 'MAT_lamp', (p) => B(p, -0.25, lampY - 0.2, d / 2 - 0.25, 0.25, lampY - 0.02, d / 2 + 0.25),
        { nav_ignore: true });

    // 家具（可无：如 f2 卫生间由独立家具 GLB 提供）
    spec.furnish?.(add, B);

    return parts;
}

// ── 写 GLB（与 make_f1_suite.mjs 同一套）──
function writeGlb(out, parts, mats) {
    const matNames = Object.keys(mats);
    const gltf = {
        asset: { version: '2.0', generator: 'make_rooms.mjs' },
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

        const mins = [0, 1, 2].map((k) => Math.min(...part.verts.filter((_, i) => i % 3 === k)));
        const maxs = [0, 1, 2].map((k) => Math.max(...part.verts.filter((_, i) => i % 3 === k)));
        const acBase = gltf.accessors.length;
        gltf.accessors.push(
            { bufferView: appendBuf(vbuf), componentType: 5126, count: part.verts.length / 3, type: 'VEC3', min: mins, max: maxs },
            { bufferView: appendBuf(nbuf), componentType: 5126, count: part.verts.length / 3, type: 'VEC3' },
            { bufferView: appendBuf(ibuf), componentType: 5123, count: part.idx.length, type: 'SCALAR' },
        );
        gltf.meshes.push({
            primitives: [{
                attributes: { POSITION: acBase, NORMAL: acBase + 1 },
                indices: acBase + 2,
                material: matNames.indexOf(mat),
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
for (const spec of ROOMS) {
    const parts = buildRoom(spec);
    writeGlb(spec.file, parts, { ...BASE_MATS, ...spec.mats });
    const doors = spec.doors.map((dr) => `${dr.name}(${dr.wall}${dr.off})→${dr.target[0]}/${dr.target[1]}`);
    console.log(`${spec.id}: ${parts.length} 节点, ${spec.w}×${spec.d}×${spec.h}`);
    console.log(`  ${doors.join('  ')}`);
}
console.log('\n全部房间已生成');
