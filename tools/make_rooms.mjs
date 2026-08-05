/** 阶段 5：批量房间生成器（11 间，纯 Node 写 GLB，无需 Blender）
 *
 * 规范同 tools/make_room_living.mjs（客厅样板间）：
 *   - 原点在主门（doors[0]，一律南墙 z=0 居中）门口地板中心；x±w/2，z 0..d
 *   - **所有门/窗只开在南墙(z=0)与北墙(z=d)**：门节点 rotY=0，
 *     南门 dir=left（开向屋内 +z），北门 dir=right（开向屋内 -z）
 *   - 门 extras: door_target_scene / door_target_spawn（传送目标）
 *   - 窗景片 MAT_window_view 标 nav_ignore（时间系统按名联动变色）
 *   - 家具不标属性（自动障碍）；地毯/盆栽等纯装饰标 nav_ignore
 *
 * 用法: node tools/make_rooms.mjs   → 写出 models/room_*.glb × 11
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

// ── 房间规格 ──
// doors:  { name, wall:'S'|'N', off(沿墙中心偏移), target:[scene,spawn] }
// windows:{ wall:'S'|'N', centers:[窗中心x..], width, y0, y1, arch }
//   窗位/数量/宽度对应外壳实测（doc/house-map.md 对应表）；arch=台阶拱窗
// gable:  { eave, ridge } 人字坡顶（阁楼）；缺省平顶
// furnish(add, B): B(x0,y0,z0,x1,y1,z1) 便捷盒体
// 结构色统一取 tools/room_palette.mjs（PALETTE / BASE_MATS 已导入）
const ROOMS = [
    {
        id: 'f1_kitchen', file: 'models/room_kitchen.glb',
        w: 7, d: 7, h: 3,
        mats: {
            MAT_wall: '#F0E6D0', MAT_floor: PALETTE.floorTile,
            MAT_counter: '#8C9AA5', MAT_fridge: '#D8E0E4',
            MAT_furniture: '#A9744F', MAT_rug: '#C9B458', MAT_pot: '#B0764A', MAT_plant: '#5E8C5A',
        },
        doors: [
            { name: 'DOOR_living', wall: 'S', off: 0, target: ['f1_living', 'fromKitchen'] },
            { name: 'DOOR_outdoor', wall: 'N', off: 2.2, target: ['outdoor', 'houseEast'] },
        ],
        // W4 北墙东段 F1 3 拱窗（避让北门洞 1.7..2.7）
        windows: [{ wall: 'N', centers: [-1.4, -0.45, 0.5], width: 0.87, y0: 0.55, y1: 2.45, arch: true }],
        furnish(add, B) {
            // 北墙台面（避开门洞 x1.7..2.7 及其摆动区）：灶台 + 水槽
            add('FURN_counter', 'MAT_counter', (p) => {
                B(p, -3.3, 0, 6.1, 1.5, 0.9, 6.9);
            });
            add('FURN_stove', 'MAT_fridge', (p) => B(p, -2.9, 0.9, 6.25, -2.1, 0.98, 6.75));
            add('FURN_fridge', 'MAT_fridge', (p) => B(p, 2.9, 0, 3.0, 3.45, 1.9, 4.0));
            // 餐桌 + 两把椅
            add('FURN_table', 'MAT_furniture', (p) => {
                B(p, -0.7, 0.66, 2.2, 0.9, 0.74, 3.4);
                for (const [lx, lz] of [[-0.7, 2.2], [0.84, 2.2], [-0.7, 3.34], [0.84, 3.34]])
                    B(p, lx, 0, lz, lx + 0.06, 0.66, lz + 0.06);
            });
            add('FURN_chairs', 'MAT_furniture', (p) => {
                B(p, -0.5, 0, 1.6, -0.1, 0.45, 2.0);
                B(p, -0.5, 0.45, 1.6, -0.1, 0.95, 1.7);
                B(p, 0.3, 0, 3.6, 0.7, 0.45, 4.0);
                B(p, 0.3, 0.45, 3.9, 0.7, 0.95, 4.0);
            });
            add('PLANT_pot', 'MAT_pot', (p) => B(p, -3.3, 0, 0.3, -2.9, 0.35, 0.7), { nav_ignore: true });
            add('PLANT_leaves', 'MAT_plant', (p) => B(p, -3.25, 0.35, 0.35, -2.95, 0.85, 0.65), { nav_ignore: true });
        },
    },
    {
        id: 'f1_bath', file: 'models/room_bath_f1.glb',
        w: 7, d: 7, h: 3,
        mats: {
            MAT_wall: '#D8E4E8', MAT_floor: PALETTE.floorTile,
            MAT_fixture: '#F4F4F0', MAT_mirror: '#B8D8E8',
        },
        doors: [
            { name: 'DOOR_living', wall: 'S', off: 0, target: ['f1_living', 'fromBath'] },
        ],
        windows: [],   // 卫生间无窗（doc/house-map.md）
        furnish(add, B) {
            add('FURN_toilet', 'MAT_fixture', (p) => {
                B(p, 2.2, 0.3, 6.1, 2.65, 0.75, 6.45);   // 水箱
                B(p, 2.2, 0, 5.65, 2.65, 0.4, 6.15);     // 座
            });
            add('FURN_sink', 'MAT_fixture', (p) => {
                B(p, -3.0, 0.68, 6.0, -2.3, 0.78, 6.55); // 盆
                B(p, -2.8, 0, 6.15, -2.5, 0.68, 6.45);   // 柱
            });
            add('MIRROR', 'MAT_mirror', (p) => B(p, -2.85, 1.05, 6.94, -2.45, 1.65, 6.98), { nav_ignore: true });
        },
    },
    {
        id: 'f2_study', file: 'models/room_study.glb',
        w: 7, d: 7, h: 3,
        mats: {
            MAT_wall: '#E8E0D0', MAT_floor: PALETTE.floorWood,
            MAT_furniture: '#A9744F', MAT_desk: '#8A6A4A',
            MAT_rug: '#7A8CAA', MAT_pot: '#B0764A', MAT_plant: '#5E8C5A',
        },
        doors: [
            { name: 'DOOR_stairs_down', wall: 'S', off: 0, target: ['f1_living', 'fromStudy'] },
            { name: 'DOOR_bed2', wall: 'S', off: -2, target: ['f2_bed2', 'default'] },
            { name: 'DOOR_bed1', wall: 'N', off: -2, target: ['f2_bed1', 'default'] },
            { name: 'DOOR_bed3', wall: 'N', off: 0, target: ['f2_bed3', 'default'] },
            { name: 'DOOR_stairs_up', wall: 'N', off: 2, target: ['attic_game_a', 'fromStudy'] },
        ],
        // W8 的 F2 层（西前立面 1 拱窗；房内 5 门占满墙面，只能放 1 窗）
        windows: [{ wall: 'S', centers: [1.95], width: 0.87, y0: 0.55, y1: 2.45, arch: true }],
        furnish(add, B) {
            // 东墙书桌 + 椅
            add('FURN_desk', 'MAT_desk', (p) => {
                B(p, 2.7, 0.64, 2.5, 3.4, 0.72, 3.9);
                B(p, 2.7, 0, 2.5, 2.82, 0.64, 3.9);
                B(p, 3.28, 0, 2.5, 3.4, 0.64, 3.9);
            });
            add('FURN_chair', 'MAT_furniture', (p) => {
                B(p, 2.05, 0, 3.0, 2.45, 0.45, 3.4);
                B(p, 2.05, 0.45, 3.0, 2.15, 0.95, 3.4);
            });
            // 西墙大书柜（北段，避开床2门洞 x-2.5..-1.5 摆动区）
            add('FURN_shelf', 'MAT_furniture', (p) => {
                B(p, -3.45, 0, 3.5, -3.05, 1.9, 6.0);
                for (const y of [0.6, 1.2]) B(p, -3.5, y, 3.55, -3.05, y + 0.06, 5.95);
            });
            add('RUG', 'MAT_rug', (p) => B(p, -1.2, 0.02, 2.5, 1.2, 0.035, 4.7), { nav_ignore: true });
            add('PLANT_pot', 'MAT_pot', (p) => B(p, 3.05, 0, 6.2, 3.45, 0.35, 6.6), { nav_ignore: true });
            add('PLANT_leaves', 'MAT_plant', (p) => B(p, 3.1, 0.35, 6.25, 3.4, 0.85, 6.55), { nav_ignore: true });
            // 实体楼梯（阶段 2.3）：东墙 z4.0→6.08 向北上行（DOOR_stairs_up 在旁，通向阁楼）
            // 8 步：踏面 0.26、级高 0.32；西沿阶梯挡板每两级一段
            add('STAIRS', 'MAT_frame', (p) => {
                for (let k = 1; k <= 8; k++) {
                    const z1 = 4.0 + 0.26 * k, z0 = z1 - 0.26, top = 0.32 * k;
                    B(p, 2.79, 0, z0, 3.45, top, z1);
                }
                B(p, 2.71, 0, 4.0, 2.79, 1.44, 4.52);
                B(p, 2.71, 0, 4.52, 2.79, 2.08, 5.04);
                B(p, 2.71, 0, 5.04, 2.79, 2.72, 5.56);
                B(p, 2.71, 0, 5.56, 2.79, 2.95, 6.08);
                B(p, 2.71, 0, 3.92, 3.45, 1.1, 4.0);   // 底部新柱（横档）
            });
        },
    },
    ...[1, 2, 3].map((n) => ({
        id: `f2_bed${n}`, file: `models/room_bed${n}.glb`,
        w: 7, d: 7, h: 3,
        mats: {
            MAT_wall: ['#F2E4E0', '#E0E8F2', '#E4F0DC'][n - 1],
            MAT_floor: PALETTE.floorWood,
            MAT_bed: ['#D98E6A', '#7A9EC9', '#8CB87A'][n - 1],
            MAT_blanket: ['#E8B49A', '#A8C4E4', '#B4D8A4'][n - 1],
            MAT_furniture: '#A9744F', MAT_rug: ['#C96F5A', '#6A8CB8', '#6AA86A'][n - 1],
        },
        doors: [
            { name: 'DOOR_study', wall: 'S', off: 0, target: ['f2_study', `fromBed${n}`] },
            { name: 'DOOR_bath', wall: 'N', off: -1.5, target: [`f2_bath${n}`, 'default'] },
        ],
        // 北墙 F2 3 拱窗（避让卫生间门洞 -2..-1）；bed3 改南墙 2 窗（W11+W13，避让南门洞）
        windows: n < 3
            ? [{ wall: 'N', centers: [-0.4, 0.55, 1.5], width: 0.87, y0: 0.55, y1: 2.45, arch: true }]
            : [{ wall: 'S', centers: [-2, 2], width: 0.87, y0: 0.55, y1: 2.45, arch: true }],
        furnish(add, B) {
            // 床（西墙，床头北端，避开浴室门洞 x-2.0..-1.0 摆动区 z>6）
            add('FURN_bed', 'MAT_bed', (p) => {
                B(p, -3.45, 0, 3.0, -2.05, 0.5, 4.7);      // 床架+床垫
                B(p, -3.45, 0.5, 3.15, -2.05, 0.58, 4.55); // 被面
            });
            add('FURN_headboard', 'MAT_furniture', (p) => B(p, -3.45, 0, 4.7, -2.05, 1.05, 4.82));
            add('FURN_wardrobe', 'MAT_furniture', (p) => B(p, 2.85, 0, 0.4, 3.45, 2.0, 1.6));
            add('FURN_desk', 'MAT_furniture', (p) => B(p, -3.4, 0, 0.35, -2.4, 0.7, 1.15));
            add('RUG', 'MAT_rug', (p) => B(p, -1.6, 0.02, 2.4, 0.4, 0.035, 4.0), { nav_ignore: true });
        },
    })),
    ...[1, 2, 3].map((n) => ({
        id: `f2_bath${n}`, file: `models/room_bath${n}.glb`,
        w: 7, d: 7, h: 3,
        mats: {
            MAT_wall: ['#E4DCD8', '#D8E0E8', '#DDE8D8'][n - 1],
            MAT_floor: PALETTE.floorTile,
            MAT_fixture: '#F4F4F0', MAT_shower: '#9AB8C8',
        },
        doors: [
            { name: 'DOOR_bed', wall: 'S', off: 0, target: [`f2_bed${n}`, 'fromBath'] },
        ],
        windows: [],   // 卫生间无窗（doc/house-map.md）
        furnish(add, B) {
            add('FURN_toilet', 'MAT_fixture', (p) => {
                B(p, 2.2, 0.3, 6.1, 2.65, 0.75, 6.45);   // 水箱
                B(p, 2.2, 0, 5.65, 2.65, 0.4, 6.15);     // 座
            });
            // 淋浴间（西墙，玻璃隔断）
            add('FURN_shower', 'MAT_shower', (p) => {
                B(p, -2.75, 0, 3.6, -2.69, 2.0, 4.55);   // 隔断
                B(p, -3.4, 1.9, 4.0, -2.75, 1.96, 4.1);  // 花洒杆
            });
            add('FURN_sink', 'MAT_fixture', (p) => {
                B(p, 0.55, 0.68, 6.0, 1.25, 0.78, 6.55);
                B(p, 0.75, 0, 6.15, 1.05, 0.68, 6.45);
            });
        },
    })),
    {
        id: 'attic_game_a', file: 'models/room_game_a.glb',
        w: 7, d: 7, h: 3,
        gable: { eave: 1.6, ridge: 3.2 },   // 人字坡顶：山墙在南北，屋脊沿 z
        mats: {
            MAT_wall: '#E0D8E8', MAT_floor: PALETTE.floorWood,
            MAT_furniture: '#8A6A4A', MAT_tv: '#2B2B33',
            MAT_sofa: '#B87AB8', MAT_rug: '#8A6AC9',
        },
        doors: [
            { name: 'DOOR_stairs', wall: 'S', off: 0, target: ['f2_study', 'fromAtticA'] },
            { name: 'DOOR_game_b', wall: 'N', off: 1.8, target: ['attic_game_b', 'default'] },
        ],
        // W14 西山墙 3 拱窗（山墙=北墙，避让北门洞 1.3..2.3；坡顶在阶段 2.2）
        windows: [{ wall: 'N', centers: [-1.9, -0.95, 0], width: 0.87, y0: 1.1, y1: 2.9, arch: true }],
        furnish(add, B) {
            // 电视柜 + 电视（东墙，避开 B 门洞 x1.3..2.3 摆动区）
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
    {
        id: 'attic_game_b', file: 'models/room_game_b.glb',
        w: 7, d: 7, h: 3,
        gable: { eave: 1.6, ridge: 3.2 },
        mats: {
            MAT_wall: '#E8DCD0', MAT_floor: PALETTE.floorWood,
            MAT_furniture: '#8A6A4A', MAT_foosball: '#4A8C6A',
            MAT_chest: '#C9A44A', MAT_rug: '#C98A5A', MAT_sofa: '#D9A06A',
        },
        doors: [
            { name: 'DOOR_game_a', wall: 'S', off: 0, target: ['attic_game_a', 'fromGameB'] },
        ],
        // W15 东山墙 3 拱窗
        windows: [{ wall: 'N', centers: [-0.95, 0, 0.95], width: 0.87, y0: 1.1, y1: 2.9, arch: true }],
        furnish(add, B) {
            // 桌上足球
            add('FURN_foosball', 'MAT_foosball', (p) => {
                B(p, -1.0, 0.72, 2.3, 0.6, 1.0, 3.5);
                for (const [lx, lz] of [[-1.0, 2.3], [0.54, 2.3], [-1.0, 3.44], [0.54, 3.44]])
                    B(p, lx, 0, lz, lx + 0.06, 0.72, lz + 0.06);
            });
            add('FURN_chest', 'MAT_chest', (p) => B(p, 2.2, 0, 5.8, 2.9, 0.6, 6.5));
            add('FURN_sofa', 'MAT_sofa', (p) => {
                B(p, -3.4, 0, 6.0, -2.4, 0.4, 6.9);
                B(p, -3.4, 0.4, 6.65, -2.4, 0.85, 6.9);
            });
            add('RUG', 'MAT_rug', (p) => B(p, -1.2, 0.02, 1.8, 0.8, 0.035, 3.8), { nav_ignore: true });
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

    // 洞口表（南/北墙：门 + 窗）；窗 centers → ranges
    const winRanges = (wn) => wn.centers.map((c) => [c - wn.width / 2, c + wn.width / 2]);
    const holesFor = (wall) => [
        ...spec.doors.filter((dr) => dr.wall === wall)
            .map((dr) => ({ a0: dr.off - DOOR_W / 2, a1: dr.off + DOOR_W / 2, y0: 0, y1: DOOR_H })),
        ...spec.windows.filter((wn) => wn.wall === wall)
            .flatMap((wn) => winRanges(wn).map(([a0, a1]) => ({ a0, a1, y0: wn.y0, y1: wn.y1, arch: wn.arch }))),
    ];
    // 洞口重叠检查（建模错误会产出碎墙）
    for (const wall of ['S', 'N']) {
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

    // 墙体：南(z=0)/北(z=d) 带洞（阁楼为山墙：矩形段+三角段），东/西 实心（阁楼到檐口）
    add('WALLS', 'MAT_wall', (p) => {
        if (!gb) {
            pushWallX(p, -WT, 0, -xw, xw, h, holesFor('S'));
            pushWallX(p, d, d + WT, -xw, xw, h, holesFor('N'));
            B(p, -xw - WT, 0, -WT, -xw, h, d + WT);
            B(p, xw, 0, -WT, xw + WT, h, d + WT);
        } else {
            pushGableWallX(p, -WT, 0, -xw, xw, gb.eave, gb.ridge, holesFor('S'));
            pushGableWallX(p, d, d + WT, -xw, xw, gb.eave, gb.ridge, holesFor('N'));
            B(p, -xw - WT, 0, -WT, -xw, gb.eave, d + WT);
            B(p, xw, 0, -WT, xw + WT, gb.eave, d + WT);
        }
    });

    // 门框 + 窗框（十字棂 + 窗台板）
    add('FRAMES', 'MAT_frame', (p) => {
        const j = 0.06;
        for (const dr of spec.doors) {
            const z0 = dr.wall === 'S' ? -WT - 0.02 : d - 0.02;
            const z1 = dr.wall === 'S' ? 0.02 : d + WT + 0.02;
            const x0 = dr.off - DOOR_W / 2, x1 = dr.off + DOOR_W / 2;
            B(p, x0 - j, 0, z0, x0, DOOR_H + j, z1);
            B(p, x1, 0, z0, x1 + j, DOOR_H + j, z1);
            B(p, x0 - j, DOOR_H, z0, x1 + j, DOOR_H + j, z1);
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

    // 门板（origin 在铰链底边；S 开向 +z dir=left，N 开向 -z dir=right）
    for (const dr of spec.doors) {
        add(dr.name, 'MAT_door', (p) => B(p, 0, 0, -0.02, 0.96, 2.06, 0.02), {
            interactable_type: 'door',
            door_swing_angle: 90.0,
            door_swing_dir: dr.wall === 'S' ? 'left' : 'right',
            door_slide: false,
            door_locked: false,
            door_target_scene: dr.target[0],
            door_target_spawn: dr.target[1],
        }, [dr.off - 0.48, 0.02, dr.wall === 'S' ? 0 : d]);
    }

    // 吊灯（装饰，nav_ignore；PointLight 位姿在 config 场景光照里）
    add('LAMP', 'MAT_lamp', (p) => B(p, -0.25, h - 0.2, d / 2 - 0.25, 0.25, h - 0.02, d / 2 + 0.25),
        { nav_ignore: true });

    // 家具
    spec.furnish(add, B);

    return parts;
}

// ── 写 GLB（与 make_room_living.mjs 同一套）──
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
