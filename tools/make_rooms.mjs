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

/** 带洞口的墙（沿 x 方向，洞在 y0..y1、a0..a1 区间掏空） */
function pushWallX(part, z0, z1, x0, x1, h, holes) {
    const sorted = [...holes].sort((a, b) => a.a0 - b.a0);
    let cur = x0;
    for (const hole of sorted) {
        if (hole.a0 - cur > 0.001) pushBox(part, [cur, 0, z0], [hole.a0, h, z1]);
        if (hole.y0 > 0.001) pushBox(part, [hole.a0, 0, z0], [hole.a1, hole.y0, z1]);
        if (h - hole.y1 > 0.001) pushBox(part, [hole.a0, hole.y1, z0], [hole.a1, h, z1]);
        cur = Math.max(cur, hole.a1);
    }
    if (x1 - cur > 0.001) pushBox(part, [cur, 0, z0], [x1, h, z1]);
}

// ── 房间规格 ──
// doors:  { name, wall:'S'|'N', off(沿墙中心偏移), target:[scene,spawn] }
// windows:{ wall:'S'|'N', ranges:[[a0,a1]..], y0, y1 }
// furnish(add, B): B(x0,y0,z0,x1,y1,z1) 便捷盒体
const BASE_MATS = {
    MAT_frame: '#6E4B32',
    MAT_door: '#8A5A3B',
    MAT_window_view: '#A8D8EA',
    MAT_lamp: '#FFE9B8',
};

const ROOMS = [
    {
        id: 'f1_kitchen', file: 'models/room_kitchen.glb',
        w: 7, d: 5, h: 2.7,
        mats: {
            MAT_wall: '#F0E6D0', MAT_floor: '#B8C4C8',
            MAT_counter: '#8C9AA5', MAT_fridge: '#D8E0E4',
            MAT_furniture: '#A9744F', MAT_rug: '#C9B458', MAT_pot: '#B0764A', MAT_plant: '#5E8C5A',
        },
        doors: [
            { name: 'DOOR_living', wall: 'S', off: 0, target: ['f1_living', 'fromKitchen'] },
            { name: 'DOOR_outdoor', wall: 'N', off: 2.2, target: ['outdoor', 'houseEast'] },
        ],
        windows: [{ wall: 'N', ranges: [[-2.6, -1.3], [-0.4, 0.9]], y0: 0.9, y1: 2.1 }],
        furnish(add, B) {
            // 北墙台面（避开门洞 x1.7..2.7）：灶台 + 水槽
            add('FURN_counter', 'MAT_counter', (p) => {
                B(p, -3.3, 0, 4.1, 1.5, 0.9, 4.9);
            });
            add('FURN_stove', 'MAT_fridge', (p) => B(p, -2.9, 0.9, 4.25, -2.1, 0.98, 4.75));
            add('FURN_fridge', 'MAT_fridge', (p) => B(p, 2.75, 0, 0.3, 3.45, 1.9, 1.3));
            // 餐桌 + 两把椅
            add('FURN_table', 'MAT_furniture', (p) => {
                B(p, -0.7, 0.66, 1.6, 0.9, 0.74, 2.8);
                for (const [lx, lz] of [[-0.7, 1.6], [0.84, 1.6], [-0.7, 2.74], [0.84, 2.74]])
                    B(p, lx, 0, lz, lx + 0.06, 0.66, lz + 0.06);
            });
            add('FURN_chairs', 'MAT_furniture', (p) => {
                B(p, -0.5, 0, 1.1, -0.1, 0.45, 1.5);
                B(p, -0.5, 0.45, 1.1, -0.1, 0.95, 1.2);
                B(p, 0.3, 0, 2.9, 0.7, 0.45, 3.3);
                B(p, 0.3, 0.45, 3.2, 0.7, 0.95, 3.3);
            });
            add('PLANT_pot', 'MAT_pot', (p) => B(p, -3.25, 0, 0.3, -2.85, 0.35, 0.7), { nav_ignore: true });
            add('PLANT_leaves', 'MAT_plant', (p) => B(p, -3.2, 0.35, 0.35, -2.9, 0.85, 0.65), { nav_ignore: true });
        },
    },
    {
        id: 'f1_bath', file: 'models/room_bath_f1.glb',
        w: 2.5, d: 2.5, h: 2.4,
        mats: {
            MAT_wall: '#D8E4E8', MAT_floor: '#A8BCC4',
            MAT_fixture: '#F4F4F0', MAT_mirror: '#B8D8E8',
        },
        doors: [
            { name: 'DOOR_living', wall: 'S', off: 0, target: ['f1_living', 'fromBath'] },
        ],
        windows: [{ wall: 'N', ranges: [[-0.4, 0.4]], y0: 1.4, y1: 2.0 }],
        furnish(add, B) {
            add('FURN_toilet', 'MAT_fixture', (p) => {
                B(p, 0.65, 0.3, 2.1, 1.1, 0.75, 2.45);   // 水箱
                B(p, 0.65, 0, 1.65, 1.1, 0.4, 2.15);     // 座
            });
            add('FURN_sink', 'MAT_fixture', (p) => {
                B(p, -1.1, 0.68, 1.85, -0.4, 0.78, 2.4); // 盆
                B(p, -0.9, 0, 2.0, -0.6, 0.68, 2.3);     // 柱
            });
            add('MIRROR', 'MAT_mirror', (p) => B(p, -0.95, 1.05, 2.44, -0.55, 1.65, 2.48), { nav_ignore: true });
        },
    },
    {
        id: 'f2_study', file: 'models/room_study.glb',
        w: 6, d: 6, h: 2.7,
        mats: {
            MAT_wall: '#E8E0D0', MAT_floor: '#C9A876',
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
        windows: [{ wall: 'S', ranges: [[1.3, 2.6]], y0: 0.9, y1: 2.1 }],
        furnish(add, B) {
            // 东墙书桌 + 椅
            add('FURN_desk', 'MAT_desk', (p) => {
                B(p, 2.2, 0.64, 2.0, 2.9, 0.72, 3.4);
                B(p, 2.2, 0, 2.0, 2.32, 0.64, 3.4);
                B(p, 2.78, 0, 2.0, 2.9, 0.64, 3.4);
            });
            add('FURN_chair', 'MAT_furniture', (p) => {
                B(p, 1.55, 0, 2.5, 1.95, 0.45, 2.9);
                B(p, 1.55, 0.45, 2.5, 1.65, 0.95, 2.9);
            });
            // 西墙大书柜（南段，避开床2门洞 x-2.5..-1.5 摆动区）
            add('FURN_shelf', 'MAT_furniture', (p) => {
                B(p, -2.95, 0, 3.2, -2.55, 1.9, 5.7);
                for (const y of [0.6, 1.2]) B(p, -3.0, y, 3.25, -2.55, y + 0.06, 5.65);
            });
            add('RUG', 'MAT_rug', (p) => B(p, -1.2, 0.02, 2.2, 1.2, 0.035, 4.4), { nav_ignore: true });
            add('PLANT_pot', 'MAT_pot', (p) => B(p, 2.55, 0, 5.2, 2.95, 0.35, 5.6), { nav_ignore: true });
            add('PLANT_leaves', 'MAT_plant', (p) => B(p, 2.6, 0.35, 5.25, 2.9, 0.85, 5.55), { nav_ignore: true });
        },
    },
    ...[1, 2, 3].map((n) => ({
        id: `f2_bed${n}`, file: `models/room_bed${n}.glb`,
        w: 5, d: 4.5, h: 2.7,
        mats: {
            MAT_wall: ['#F2E4E0', '#E0E8F2', '#E4F0DC'][n - 1],
            MAT_floor: '#C9A876',
            MAT_bed: ['#D98E6A', '#7A9EC9', '#8CB87A'][n - 1],
            MAT_blanket: ['#E8B49A', '#A8C4E4', '#B4D8A4'][n - 1],
            MAT_furniture: '#A9744F', MAT_rug: ['#C96F5A', '#6A8CB8', '#6AA86A'][n - 1],
        },
        doors: [
            { name: 'DOOR_study', wall: 'S', off: 0, target: ['f2_study', `fromBed${n}`] },
            { name: 'DOOR_bath', wall: 'N', off: -1.5, target: [`f2_bath${n}`, 'default'] },
        ],
        windows: [{ wall: 'N', ranges: [[0.6, 2.0]], y0: 0.9, y1: 2.1 }],
        furnish(add, B) {
            // 床（西北角，避开浴室门洞 x-2.0..-1.0 摆动区 z<4.5）
            add('FURN_bed', 'MAT_bed', (p) => {
                B(p, -2.35, 0, 1.6, -0.95, 0.5, 3.3);      // 床架+床垫
                B(p, -2.35, 0.5, 1.75, -0.95, 0.58, 3.1);  // 被面
            });
            add('FURN_headboard', 'MAT_furniture', (p) => B(p, -2.35, 0, 3.3, -0.95, 1.05, 3.42));
            add('FURN_wardrobe', 'MAT_furniture', (p) => B(p, 1.9, 0, 0.2, 2.45, 2.0, 1.4));
            add('FURN_desk', 'MAT_furniture', (p) => B(p, -2.35, 0, 0.4, -1.35, 0.7, 1.2));
            add('RUG', 'MAT_rug', (p) => B(p, -0.6, 0.02, 1.6, 1.3, 0.035, 3.2), { nav_ignore: true });
        },
    })),
    ...[1, 2, 3].map((n) => ({
        id: `f2_bath${n}`, file: `models/room_bath${n}.glb`,
        w: 2.5, d: 2.5, h: 2.4,
        mats: {
            MAT_wall: ['#E4DCD8', '#D8E0E8', '#DDE8D8'][n - 1],
            MAT_floor: '#A8BCC4',
            MAT_fixture: '#F4F4F0', MAT_shower: '#9AB8C8',
        },
        doors: [
            { name: 'DOOR_bed', wall: 'S', off: 0, target: [`f2_bed${n}`, 'fromBath'] },
        ],
        windows: [{ wall: 'N', ranges: [[-0.4, 0.4]], y0: 1.4, y1: 2.0 }],
        furnish(add, B) {
            add('FURN_toilet', 'MAT_fixture', (p) => {
                B(p, 0.65, 0.3, 2.1, 1.1, 0.75, 2.45);
                B(p, 0.65, 0, 1.65, 1.1, 0.4, 2.15);
            });
            // 淋浴间（西墙，玻璃隔断）
            add('FURN_shower', 'MAT_shower', (p) => {
                B(p, -1.2, 0, 1.5, -1.14, 2.0, 2.45);      // 隔断
                B(p, -1.14, 1.9, 1.9, -0.7, 1.96, 2.0);    // 花洒杆
            });
            add('FURN_sink', 'MAT_fixture', (p) => {
                B(p, 0.3, 0.68, 1.85, 1.0, 0.78, 2.4);
                B(p, 0.5, 0, 2.0, 0.8, 0.68, 2.3);
            });
        },
    })),
    {
        id: 'attic_game_a', file: 'models/room_game_a.glb',
        w: 6, d: 5, h: 2.4,
        mats: {
            MAT_wall: '#E0D8E8', MAT_floor: '#B89A78',
            MAT_furniture: '#8A6A4A', MAT_tv: '#2B2B33',
            MAT_sofa: '#B87AB8', MAT_rug: '#8A6AC9',
        },
        doors: [
            { name: 'DOOR_stairs', wall: 'S', off: 0, target: ['f2_study', 'fromAtticA'] },
            { name: 'DOOR_game_b', wall: 'N', off: 1.8, target: ['attic_game_b', 'default'] },
        ],
        windows: [{ wall: 'N', ranges: [[-2.2, -0.9]], y0: 0.8, y1: 1.9 }],
        furnish(add, B) {
            // 电视柜 + 电视（东北，避开 B 门洞 x1.3..2.3）
            add('FURN_tvstand', 'MAT_furniture', (p) => B(p, 2.5, 0, 3.9, 2.95, 0.5, 4.4));
            add('FURN_tv', 'MAT_tv', (p) => B(p, 2.55, 0.5, 4.0, 2.9, 1.35, 4.32));
            // 懒人沙发朝电视
            add('FURN_sofa', 'MAT_sofa', (p) => {
                B(p, 1.3, 0, 1.9, 2.3, 0.42, 2.8);
                B(p, 1.3, 0.42, 1.9, 2.3, 0.7, 2.1);
            });
            // 西墙游戏架
            add('FURN_shelf', 'MAT_furniture', (p) => {
                B(p, -2.95, 0, 2.0, -2.6, 1.6, 4.4);
                B(p, -2.98, 0.7, 2.05, -2.6, 0.76, 4.35);
            });
            add('RUG', 'MAT_rug', (p) => B(p, -1.4, 0.02, 1.4, 0.9, 0.035, 3.6), { nav_ignore: true });
        },
    },
    {
        id: 'attic_game_b', file: 'models/room_game_b.glb',
        w: 5, d: 4.5, h: 2.4,
        mats: {
            MAT_wall: '#E8DCD0', MAT_floor: '#B89A78',
            MAT_furniture: '#8A6A4A', MAT_foosball: '#4A8C6A',
            MAT_chest: '#C9A44A', MAT_rug: '#C98A5A', MAT_sofa: '#D9A06A',
        },
        doors: [
            { name: 'DOOR_game_a', wall: 'S', off: 0, target: ['attic_game_a', 'fromGameB'] },
        ],
        windows: [{ wall: 'N', ranges: [[-0.8, 0.8]], y0: 0.8, y1: 1.9 }],
        furnish(add, B) {
            // 桌上足球
            add('FURN_foosball', 'MAT_foosball', (p) => {
                B(p, -1.0, 0.72, 1.5, 0.6, 1.0, 2.7);
                for (const [lx, lz] of [[-1.0, 1.5], [0.54, 1.5], [-1.0, 2.64], [0.54, 2.64]])
                    B(p, lx, 0, lz, lx + 0.06, 0.72, lz + 0.06);
            });
            add('FURN_chest', 'MAT_chest', (p) => B(p, 1.7, 0, 3.5, 2.4, 0.6, 4.2));
            add('FURN_sofa', 'MAT_sofa', (p) => {
                B(p, -2.35, 0, 3.3, -1.35, 0.4, 4.2);
                B(p, -2.35, 0.4, 3.95, -1.35, 0.85, 4.2);
            });
            add('RUG', 'MAT_rug', (p) => B(p, -1.4, 0.02, 1.2, 1.0, 0.035, 3.2), { nav_ignore: true });
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

    // 洞口表（南/北墙：门 + 窗）
    const holesFor = (wall) => [
        ...spec.doors.filter((dr) => dr.wall === wall)
            .map((dr) => ({ a0: dr.off - DOOR_W / 2, a1: dr.off + DOOR_W / 2, y0: 0, y1: DOOR_H })),
        ...spec.windows.filter((wn) => wn.wall === wall)
            .flatMap((wn) => wn.ranges.map(([a0, a1]) => ({ a0, a1, y0: wn.y0, y1: wn.y1 }))),
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

    // 地板 + WALK 逻辑面 + 天花板
    add('FLOOR_visible', 'MAT_floor', (p) => B(p, -xw, -0.06, 0, xw, 0, d));
    add('WALK_floor', 'MAT_floor',
        (p) => pushQuadXZ(p, -xw + 0.05, 0.05, xw - 0.05, d - 0.05, 0.015),
        { surface_walkable: true });
    add('CEILING', 'MAT_wall', (p) => B(p, -xw - WT, h, -WT, xw + WT, h + 0.12, d + WT));

    // 墙体：南(z=0)/北(z=d) 带洞，东/西 实心
    add('WALLS', 'MAT_wall', (p) => {
        pushWallX(p, -WT, 0, -xw, xw, h, holesFor('S'));
        pushWallX(p, d, d + WT, -xw, xw, h, holesFor('N'));
        B(p, -xw - WT, 0, -WT, -xw, h, d + WT);
        B(p, xw, 0, -WT, xw + WT, h, d + WT);
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
            for (const [x0, x1] of wn.ranges) {
                B(p, x0 - j, wn.y0 - j, z0, x0, wn.y1 + j, z1);
                B(p, x1, wn.y0 - j, z0, x1 + j, wn.y1 + j, z1);
                B(p, x0 - j, wn.y1, z0, x1 + j, wn.y1 + j, z1);
                B(p, x0 - j - 0.02, wn.y0 - j - 0.04, Math.min(z0, z1) - 0.01, x1 + j + 0.02, wn.y0, Math.max(z0, z1));
                const cx = (x0 + x1) / 2, cy = (wn.y0 + wn.y1) / 2, m = 0.02;
                B(p, cx - m, wn.y0, zw0, cx + m, wn.y1, zw1);   // 竖棂
                B(p, x0, cy - m, zw0, x1, cy + m, zw1);         // 横棂
            }
        }
    });

    // 窗景片（每面有窗的墙一片，外侧 0.4m）
    for (const wn of spec.windows) {
        const a0 = Math.min(...wn.ranges.map((r) => r[0])) - 0.4;
        const a1 = Math.max(...wn.ranges.map((r) => r[1])) + 0.4;
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
