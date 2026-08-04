/** 阶段 3.1：客厅样板间生成器（纯 Node 写 GLB，无需 Blender）
 *
 * 原计划为 Blender 脚本（tools/make_room_living.py）；当前设备无 Blender，
 * 改为程序化直写 GLB（与 tools/add_shell_core.mjs 同一套 glTF 写法）。
 *
 * 全项目房间规范（后续 11 间房以此为模板）：
 *   - 坐标系：房间独立坐标，**原点在门口地板中心**（three 坐标：y 上，z 进房间）
 *   - 地板：可见 FLOOR_visible + WALK_floor 逻辑面（抬高 0.015，
 *     extras surface_walkable=True，JS 端隐藏只作导航数据）
 *   - 墙/天花板/家具：平涂材质（rough=1/metal=0），不标属性（自动障碍）；
 *     纯装饰（地毯/盆栽/吊灯/窗景片）标 nav_ignore
 *   - 门：独立 mesh、origin 在铰链底边、door extras +
 *     door_target_scene / door_target_spawn（传送目标）
 *   - 窗户：墙体开口 + 窗框；窗口外侧放窗景片（材质 MAT_window_view，
 *     标 nav_ignore；时间系统按材质名联动变色，阶段 4）
 *
 * 用法: node tools/make_room_living.mjs   → 写出 models/room_living.glb
 */
import { writeFileSync } from 'node:fs';

const OUT = 'models/room_living.glb';

// ── 房间参数 ──
const W = 7, D = 7, H = 3, WT = 0.1;            // 内空 x±3.5, z 0..7, 墙高 3, 墙厚 0.1
const DOOR_W = 1.0, DOOR_H = 2.1;               // 门洞（南墙 z=0，居中于原点）
const WIN_Y0 = 0.9, WIN_Y1 = 2.1;               // 窗洞高
const WIN_X = [[-1.9, -0.6], [1.95, 2.95]];    // 北墙两个窗洞 x 区间
// 阶段 5：南墙加厨房/客卫门，北墙加楼梯门（→学习室）
const S_DOORS = [-1.8, 0, 1.8];                 // 南墙三个门洞中心（客卫/出口/厨房）
const STAIRS_DOOR_X = 1.3;                      // 北墙楼梯门洞中心（落点避开电视柜/沙发/茶几）

// ── 材质（平涂：rough=1 metal=0）──
const MATS = {
    MAT_wall: '#F2E9D8',
    MAT_floor: '#C9A876',
    MAT_frame: '#6E4B32',
    MAT_door: '#8A5A3B',
    MAT_window_view: '#A8D8EA',   // 窗景片：白天亮蓝（时段变色阶段 4 做）
    MAT_sofa: '#D98E6A',
    MAT_furniture: '#A9744F',
    MAT_tv: '#2B2B33',
    MAT_rug: '#C96F5A',
    MAT_pot: '#B0764A',
    MAT_plant: '#5E8C5A',
    MAT_lamp: '#FFE9B8',
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

// ── 房间建模 ──
const parts = [];   // { name, mat, extras?, translation?, part }
function add(name, mat, build, extras = null, translation = null) {
    const part = makePart();
    build(part);
    parts.push({ name, mat, extras, translation, part });
}

// 可见地板 + WALK 逻辑面（抬高 0.015）
add('FLOOR_visible', 'MAT_floor', (p) => pushBox(p, [-W / 2, -0.06, 0], [W / 2, 0, D]));
add('WALK_floor', 'MAT_floor', (p) => pushQuadXZ(p, -W / 2 + 0.05, 0.05, W / 2 - 0.05, D - 0.05, 0.015),
    { surface_walkable: true });

// 墙体（南墙三门洞、北墙两窗洞+楼梯门洞）
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
    // 北墙（z=D，开洞按 x 排序：窗0 [-1.9,-0.6]、楼梯门 [sd0,sd1]、窗1 [1.95,2.95]）
    const sd0 = STAIRS_DOOR_X - DOOR_W / 2, sd1 = STAIRS_DOOR_X + DOOR_W / 2;
    pushBox(p, [-xw, 0, D], [WIN_X[0][0], H, D + WT]);
    pushBox(p, [WIN_X[0][1], 0, D], [sd0, H, D + WT]);
    pushBox(p, [sd0, DOOR_H, D], [sd1, H, D + WT]);      // 楼梯门过梁
    pushBox(p, [sd1, 0, D], [WIN_X[1][0], H, D + WT]);
    pushBox(p, [WIN_X[1][1], 0, D], [xw, H, D + WT]);
    for (const [x0, x1] of WIN_X) {
        pushBox(p, [x0, 0, D], [x1, WIN_Y0, D + WT]);          // 窗台
        pushBox(p, [x0, WIN_Y1, D], [x1, H, D + WT]);          // 窗上过梁
    }
    // 西/东墙（封住转角）
    pushBox(p, [-xw - WT, 0, -WT], [-xw, H, D + WT]);
    pushBox(p, [xw, 0, -WT], [xw + WT, H, D + WT]);
});

// 天花板
add('CEILING', 'MAT_wall', (p) => pushBox(p, [-W / 2 - WT, H, -WT], [W / 2 + WT, H + 0.12, D + WT]));

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
    // 北墙楼梯门框
    {
        const x0 = STAIRS_DOOR_X - DOOR_W / 2, x1 = STAIRS_DOOR_X + DOOR_W / 2;
        pushBox(p, [x0 - j, 0, D - 0.02], [x0, DOOR_H + j, D + WT + 0.02]);
        pushBox(p, [x1, 0, D - 0.02], [x1 + j, DOOR_H + j, D + WT + 0.02]);
        pushBox(p, [x0 - j, DOOR_H, D - 0.02], [x1 + j, DOOR_H + j, D + WT + 0.02]);
    }
    // 窗框
    for (const [x0, x1] of WIN_X) {
        const z0 = D - 0.03, z1 = D + WT + 0.03;
        pushBox(p, [x0 - j, WIN_Y0 - j, z0], [x0, WIN_Y1 + j, z1]);   // 边框
        pushBox(p, [x1, WIN_Y0 - j, z0], [x1 + j, WIN_Y1 + j, z1]);
        pushBox(p, [x0 - j, WIN_Y1, z0], [x1 + j, WIN_Y1 + j, z1]);
        pushBox(p, [x0 - j - 0.02, WIN_Y0 - j - 0.04, z0 - 0.04], [x1 + j + 0.02, WIN_Y0, z1]); // 窗台板
        const cx = (x0 + x1) / 2, cy = (WIN_Y0 + WIN_Y1) / 2, m = 0.02;
        pushBox(p, [cx - m, WIN_Y0, D], [cx + m, WIN_Y1, D + WT]);    // 竖棂
        pushBox(p, [x0, cy - m, D], [x1, cy + m, D + WT]);            // 横棂
    }
});

// 窗景片（北墙外侧大面片，时间系统按材质名联动变色）
add('VIEW_window', 'MAT_window_view', (p) =>
    pushBox(p, [WIN_X[0][0] - 0.4, WIN_Y0 - 0.25, D + 0.4],
               [WIN_X[1][1] + 0.4, WIN_Y1 + 0.25, D + 0.46]),
    { nav_ignore: true });

// 家具（不标属性 = 自动障碍）
add('FURN_sofa', 'MAT_sofa', (p) => {   // 靠西墙，面朝 +x
    pushBox(p, [-3.05, 0, 3.6], [-2.15, 0.42, 4.6]);      // 座
    pushBox(p, [-3.35, 0, 3.6], [-3.05, 0.92, 4.6]);      // 靠背
    pushBox(p, [-3.05, 0.42, 3.6], [-2.15, 0.66, 3.8]);   // 扶手
    pushBox(p, [-3.05, 0.42, 4.4], [-2.15, 0.66, 4.6]);
});
add('FURN_table', 'MAT_furniture', (p) => {   // 沙发前茶几
    pushBox(p, [-1.75, 0.32, 3.75], [-0.85, 0.40, 4.45]);
    for (const [lx, lz] of [[-1.75, 3.75], [-0.91, 3.75], [-1.75, 4.39], [-0.91, 4.39]])
        pushBox(p, [lx, 0, lz], [lx + 0.06, 0.32, lz + 0.06]);
});
add('FURN_tvstand', 'MAT_furniture', (p) => pushBox(p, [2.85, 0, 3.65], [3.4, 0.5, 4.55]));
add('FURN_tv', 'MAT_tv', (p) => pushBox(p, [2.95, 0.5, 3.75], [3.15, 1.35, 4.45]));
add('FURN_shelf', 'MAT_furniture', (p) => {   // 东墙书柜
    pushBox(p, [3.05, 0, 0.3], [3.4, 1.9, 1.5]);
    pushBox(p, [3.0, 0.6, 0.35], [3.05, 0.66, 1.45]);     // 层板
    pushBox(p, [3.0, 1.2, 0.35], [3.05, 1.26, 1.45]);
});

// 纯装饰（nav_ignore）
add('RUG', 'MAT_rug', (p) => pushBox(p, [-1.6, 0.02, 3.0], [0.8, 0.035, 4.9]),
    { nav_ignore: true });
add('PLANT_pot', 'MAT_pot', (p) => pushBox(p, [-3.35, 0, 0.25], [-2.95, 0.35, 0.65]),
    { nav_ignore: true });
add('PLANT_leaves', 'MAT_plant', (p) => pushBox(p, [-3.3, 0.35, 0.3], [-3.0, 0.85, 0.6]),
    { nav_ignore: true });
add('LAMP', 'MAT_lamp', (p) => pushBox(p, [-0.25, H - 0.2, D / 2 - 0.25], [0.25, H - 0.02, D / 2 + 0.25]),
    { nav_ignore: true });

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

// 阶段 5 新增三扇传送门（南门 dir=left 开向屋内，北门 dir=right）
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
add('DOOR_stairs', 'MAT_door', (p) => pushBox(p, [0, 0, -0.02], [0.96, 2.06, 0.02]),
    {
        interactable_type: 'door',
        door_swing_angle: 90.0,
        door_swing_dir: 'right',
        door_slide: false,
        door_locked: false,
        door_target_scene: 'f2_study',
        door_target_spawn: 'default',
    },
    [STAIRS_DOOR_X - 0.48, 0.02, D]);

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
