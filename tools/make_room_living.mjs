/** 客厅生成器（纯 Node 写 GLB，无需 Blender）
 *
 * 2026-09 三次改造：房间扩容 7×7 → **10 宽 × 12 深**（x ±5，z 0..12），
 * 先做空壳（只有门/窗/楼梯），家具后续再加。
 *
 * 楼梯（本版核心改动）：
 *   - 沿**东墙**从南向北上爬（17 步，踏面 0.28、级高 3.0/17≈0.176），
 *     东北角到顶平台（y=3.0），顶部升入天花板井口上的 STAIRWELL 暗井；
 *   - 楼梯**可行走**：每步顶面 + 平台铺 WALK_ 面（surface_walkable），
 *     可见梯体 STAIRS 标 nav_ignore（导航只认 WALK_ 面）；
 *   - 传送上楼 = 走入暗井触发区（config.js f1_living.triggers → f2_study），
 *     不再设楼梯门；学习室回程落在楼梯顶（spawns.fromStudy）。
 *
 * 全项目房间规范（其余 11 间房以 make_rooms.mjs 为模板，规范一致）：
 *   - 坐标系：房间独立坐标，**原点在门口地板中心**（three 坐标：y 上，z 进房间）
 *   - 地板：可见 FLOOR_visible + WALK_floor 逻辑面（抬高 0.015，
 *     extras surface_walkable=True，JS 端隐藏只作导航数据）
 *   - 墙/天花板/家具：平涂材质（rough=1/metal=0），不标属性（自动障碍）；
 *     纯装饰（窗景片/暗井/可见梯体）标 nav_ignore
 *   - 门：独立 mesh、origin 在铰链底边、door extras +
 *     door_target_scene / door_target_spawn（传送目标）
 *   - 窗户：墙体开口 + 窗框；窗口外侧放窗景片（材质 MAT_window_view，
 *     标 nav_ignore；时间系统按材质名联动变色）
 *
 * 用法: node tools/make_room_living.mjs   → 写出 models/room_living.glb
 */
import { writeFileSync } from 'node:fs';
import { PALETTE } from './room_palette.mjs';

const OUT = 'models/room_living.glb';

// ── 房间参数 ──
const W = 10, D = 12, H = 3, WT = 0.1;          // 内空 x±5, z 0..12, 墙高 3, 墙厚 0.1
const DOOR_W = 1.0, DOOR_H = 2.1;               // 门洞（南墙 z=0，居中于原点）
// 北墙 3 拱窗偏西（让开东墙楼梯；窗宽 0.87 间距 0.95，与外壳 W1 语汇一致）
const WIN = { centers: [-3.0, -2.05, -1.1], width: 0.87, y0: 0.55, y1: 2.45, arch: true };
const WIN_X = WIN.centers.map((c) => [c - WIN.width / 2, c + WIN.width / 2]);
// 南墙三门：客卫 / 大门（居中）/ 厨房
const S_DOORS = [-2.8, 0, 2.8];
// 楼梯：东墙（x 4.1..5.0），z 5.9 起步向北爬 17 步到 y=3.0，东北角平台
const ST = {
    x0: 4.1, z0: 5.9, steps: 17,
    tread: 0.28, rise: 3.0 / 17,
    landingZ0: 5.9 + 16 * 0.28,    // 最后一步 z 起点 10.38；平台延伸到北墙
};
// 天花板井口（楼梯上段上方）：x 4.0..5.1, z 7.4..12.1
const HOLE = { x0: 4.0, x1: W / 2 + WT, z0: 7.4, z1: D + WT };

// ── 材质（平涂：rough=1 metal=0）；结构色统一取 tools/room_palette.mjs ──
const MATS = {
    MAT_wall: PALETTE.wall,
    MAT_floor: PALETTE.floorWood,
    MAT_frame: PALETTE.frame,
    MAT_door: PALETTE.door,
    MAT_window_view: PALETTE.windowView,   // 窗景片：时间系统按名联动变色
    MAT_stairs: '#C09A6B',     // 浅木踏步
    MAT_stairwell: '#14100C',  // 楼梯间暗井
};

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
const FACES = [   // [法线, 四角顶点(相对 min/max 的取法)]
    [[1, 0, 0], [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]]],
    [[-1, 0, 0], [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]]],
    [[0, 1, 0], [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]]],
    [[0, -1, 0], [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]]],
    [[0, 0, 1], [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]]],
    [[0, 0, -1], [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]]],
];

function makePart() {
    return { verts: [], norms: [], idx: [] };
}

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
 *  两级收缩 ×0.7/×0.35 各 0.15 高——与 make_rooms.mjs / 外壳 WINDOW_01 同一语汇） */
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

// ── 房间建模 ──
const parts = [];   // { name, mat, extras?, translation?, part }
function add(name, mat, build, extras = null, translation = null) {
    const part = makePart();
    build(part);
    parts.push({ name, mat, extras, translation, part });
}

// 可见地板
add('FLOOR_visible', 'MAT_floor', (p) => pushBox(p, [-W / 2, -0.06, 0], [W / 2, 0, D]));

// WALK 逻辑面（抬高 0.015）：主地板让开楼梯带（x>3.05, z>4.7），
// 楼梯每步顶面 + 顶部平台各铺一片——导航只认这些面
add('WALK_floor', 'MAT_floor', (p) => {
    pushQuadXZ(p, -W / 2 + 0.05, 0.05, ST.x0 - 0.05, D - 0.05, 0.015);          // 主地板
    pushQuadXZ(p, ST.x0 - 0.05, 0.05, W / 2 - 0.05, ST.z0 - 0.05, 0.015);       // 楼梯南侧条
}, { surface_walkable: true });
add('WALK_stairs', 'MAT_stairs', (p) => {
    for (let k = 1; k <= ST.steps; k++) {
        const z0 = ST.z0 + (k - 1) * ST.tread;
        // x 向西伸出 0.1 与地板面交叠（否则 5cm 缝隙卡走位的格子采样）
        pushQuadXZ(p, ST.x0 - 0.1, z0, W / 2 - 0.05, z0 + ST.tread, k * ST.rise + 0.015);
    }
    pushQuadXZ(p, ST.x0 - 0.1, ST.landingZ0, W / 2 - 0.05, D - 0.05, 3.0 + 0.015);    // 平台
}, { surface_walkable: true });

// 墙体（南墙三门洞、北墙三拱窗洞；楼梯从东墙上楼，北墙不再开楼梯门）
add('WALLS', 'MAT_wall', (p) => {
    const xw = W / 2;
    // 南墙（z=0，门洞在 S_DOORS 各处 x±0.5 高 2.1）
    const sHoles = S_DOORS.map((c) => [c - DOOR_W / 2, c + DOOR_W / 2]);
    let cur = -xw;
    for (const [x0, x1] of sHoles) {
        pushBox(p, [cur, 0, -WT], [x0, H, 0]);
        pushBox(p, [x0, DOOR_H, -WT], [x1, H, 0]);       // 门上过梁
        cur = x1;
    }
    pushBox(p, [cur, 0, -WT], [xw, H, 0]);
    // 北墙（z=D：3 拱窗洞，无门洞）
    pushWallX(p, D, D + WT, -xw, xw, H,
        WIN_X.map(([a0, a1]) => ({ a0, a1, y0: WIN.y0, y1: WIN.y1, arch: true })));
    // 西/东墙（封住转角）
    pushBox(p, [-xw - WT, 0, -WT], [-xw, H, D + WT]);
    pushBox(p, [xw, 0, -WT], [xw + WT, H, D + WT]);
});

// 天花板（楼梯上段上方开井口，井口上罩暗井黑盒）
add('CEILING', 'MAT_wall', (p) => {
    pushBox(p, [-W / 2 - WT, H, -WT], [W / 2 + WT, H + 0.12, HOLE.z0]);   // 南侧整板
    pushBox(p, [-W / 2 - WT, H, HOLE.z0], [HOLE.x0, H + 0.12, D + WT]);   // 井口西条
});
// 楼梯间暗井（底面从井下看 = "通向二楼的黑暗"；传送触发区在平台处）
add('STAIRWELL', 'MAT_stairwell', (p) =>
    pushBox(p, [HOLE.x0 - 0.05, H, HOLE.z0 - 0.05], [HOLE.x1 + 0.05, H + 1.4, HOLE.z1 + 0.05]),
    { nav_ignore: true });

// 门框 + 窗框（含十字窗棂、窗台板）
add('FRAMES', 'MAT_frame', (p) => {
    const j = 0.06;   // 框条宽
    // 南墙门框（凸出墙面两侧各 0.02）
    for (const c of S_DOORS) {
        const x0 = c - DOOR_W / 2, x1 = c + DOOR_W / 2;
        pushBox(p, [x0 - j, 0, -WT - 0.02], [x0, DOOR_H + j, 0.02]);
        pushBox(p, [x1, 0, -WT - 0.02], [x1 + j, DOOR_H + j, 0.02]);
        pushBox(p, [x0 - j, DOOR_H, -WT - 0.02], [x1 + j, DOOR_H + j, 0.02]);
    }
    // 窗框（拱窗：边框到起拱线 + 拱顶踏步框 + 矩形段十字棂 + 窗台板）
    for (const [x0, x1] of WIN_X) {
        const z0 = D - 0.03, z1 = D + WT + 0.03;
        const ys = WIN.y1 - 0.3;   // 起拱线
        const j2 = 0.06;
        pushBox(p, [x0 - j2, WIN.y0 - j2, z0], [x0, ys + j2, z1]);   // 边框
        pushBox(p, [x1, WIN.y0 - j2, z0], [x1 + j2, ys + j2, z1]);
        pushBox(p, [x0 - j2 - 0.02, WIN.y0 - j2 - 0.04, z0 - 0.04], [x1 + j2 + 0.02, WIN.y0, z1]); // 窗台板
        const cx = (x0 + x1) / 2, cy = (WIN.y0 + ys) / 2, m = 0.02;
        pushBox(p, [cx - m, WIN.y0, D], [cx + m, ys, D + WT]);       // 竖棂（矩形段）
        pushBox(p, [x0, cy - m, D], [x1, cy + m, D + WT]);           // 横棂
        // 拱顶框：起拱线横梁 + 两级踏步边梃 + 顶梁
        const w = x1 - x0, hw1 = w * 0.7 / 2, hw2 = w * 0.35 / 2;
        pushBox(p, [x0 - j2, ys, z0], [x1 + j2, ys + j2, z1]);
        pushBox(p, [cx - hw1 - j2, ys, z0], [cx - hw1, ys + 0.15, z1]);
        pushBox(p, [cx + hw1, ys, z0], [cx + hw1 + j2, ys + 0.15, z1]);
        pushBox(p, [cx - hw2 - j2, ys + 0.15, z0], [cx - hw2, WIN.y1, z1]);
        pushBox(p, [cx + hw2, ys + 0.15, z0], [cx + hw2 + j2, WIN.y1, z1]);
        pushBox(p, [cx - hw2 - j2, WIN.y1, z0], [cx + hw2 + j2, WIN.y1 + j2, z1]);
    }
});

// 窗景片（北墙外侧大面片，时间系统按材质名联动变色）
add('VIEW_window', 'MAT_window_view', (p) =>
    pushBox(p, [WIN_X[0][0] - 0.4, WIN.y0 - 0.25, D + 0.4],
               [WIN_X[WIN_X.length - 1][1] + 0.4, WIN.y1 + 0.25, D + 0.46]),
    { nav_ignore: true });

// 楼梯可见梯体（17 步实体到地 + 顶部平台实体；导航走 WALK_stairs，梯体只作外观）
add('STAIRS', 'MAT_stairs', (p) => {
    for (let k = 1; k <= ST.steps; k++) {
        const z0 = ST.z0 + (k - 1) * ST.tread, top = k * ST.rise;
        pushBox(p, [ST.x0, 0, z0], [W / 2, top, z0 + ST.tread]);            // 实心踏步
    }
    pushBox(p, [ST.x0 - 0.05, 0, ST.landingZ0], [W / 2 + 0.05, 3.0, D + 0.05]); // 平台（东北角实体）
}, { nav_ignore: true });

// 出口门：原点在铰链底边（x=-0.48 西侧门框），向屋内（+z）平开 90°
// doors.js: dir left=-1 → rotation.y = -90° → 门板从 +x 转向 +z（屋内）
add('DOOR_exit', 'MAT_door', (p) => pushBox(p, [0, 0, -0.02], [0.96, 2.06, 0.02]),
    {
        interactable_type: 'door',
        door_swing_angle: 90.0,
        door_swing_dir: 'left',
        door_slide: false,
        door_locked: false,
        door_target_scene: 'outdoor',
        door_target_spawn: 'houseWest',
    },
    [-DOOR_W / 2 + 0.02, 0.02, 0]);

// 南墙另外两扇传送门（dir=left 开向屋内）
add('DOOR_bath', 'MAT_door', (p) => pushBox(p, [0, 0, -0.02], [0.96, 2.06, 0.02]),
    {
        interactable_type: 'door',
        door_swing_angle: 90.0,
        door_swing_dir: 'left',
        door_slide: false,
        door_locked: false,
        door_target_scene: 'f1_bath',
        door_target_spawn: 'default',
    },
    [S_DOORS[0] - 0.48, 0.02, 0]);
add('DOOR_kitchen', 'MAT_door', (p) => pushBox(p, [0, 0, -0.02], [0.96, 2.06, 0.02]),
    {
        interactable_type: 'door',
        door_swing_angle: 90.0,
        door_swing_dir: 'left',
        door_slide: false,
        door_locked: false,
        door_target_scene: 'f1_kitchen',
        door_target_spawn: 'default',
    },
    [S_DOORS[2] - 0.48, 0.02, 0]);

// ── 写 GLB ──
const matNames = Object.keys(MATS);
const gltf = {
    asset: { version: '2.0', generator: 'make_room_living.mjs' },
    scene: 0,
    scenes: [{ nodes: [] }],
    nodes: [],
    meshes: [],
    materials: matNames.map((name) => ({
        name,
        pbrMetallicRoughness: {
            baseColorFactor: hexToLinear(MATS[name]),
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

// 打包 GLB
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
writeFileSync(OUT, Buffer.concat([head, jh, json, bh, bin]));

console.log(`已生成 ${OUT}: ${parts.length} 节点, ${(bin.length / 1024).toFixed(1)} KB 几何`);
console.log('节点:', parts.map((p) => p.name).join(', '));
