/** 客厅生成器（纯 Node 写 GLB，无需 Blender）
 *
 * 2026-09 三次改造：房间扩容 7×7 → **10 宽 × 12 深**（x ±5，z 0..12），
 * 先做空壳（只有门/窗/楼梯），家具后续再加；层高后抬到 **4.5m 高厅**
 * （楼梯平台/井道基座保持 y=3.0 二楼标高不变，北墙 3 拱窗随层高抬高）。
 *
 * 楼梯（局部挑高楼梯间方案）：
 *   - 沿**东墙**从南向北上爬（17 步，踏面 0.28、级高 3.0/17≈0.176，宽 1.1），
 *     **悬空梯**：0.07 厚悬臂踏步板（东端插墙、梯下挑空，胡桃木色），
 *     西缘细栏杆（RAILING：每步立柱+踏步式细扶手）；顶部平台为薄板，
 *     梯下高段+平台壁龛可走（踏步 nav_no_inflate 障碍，净空规则自动剔除低段）；
 *   - 楼梯上段上方天花板开井口，井道上挑到 y=5.2（SHAFT 井道墙 + 顶盖），
 *     全梯段净空充足；井道北墙在平台层开顶部门洞，门洞后 STAIRWELL 暗龛；
 *   - 传送上楼 = 走上平台、将进门洞时触发（config.js f1_living.triggers → f2_study）；
 *     学习室回程落在平台上、触发区南侧（spawns.fromStudy，不回环）；
 *   - 楼梯**可行走**：每步顶面 + 平台铺 WALK_ 面（surface_walkable），
 *     可见梯体 STAIRS / 暗龛标 nav_ignore（导航只认 WALK_ 面）；
 *     WALK_stairs 带 extras stairs_to=梯顶门洞口，点楼梯任意处自动上楼（walker.js）；
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
const W = 10, D = 12, H = 4.5, WT = 0.1;        // 内空 x±5, z 0..12, 墙高 4.5（高厅）, 墙厚 0.1
const DOOR_W = 1.0, DOOR_H = 2.1;               // 门洞（南墙 z=0，居中于原点）
// 北墙 3 拱窗偏西（让开东墙楼梯；拱形/3 扇布局与外壳 W1 语汇一致，
// 2026-09 应要求加大：宽 1.2 间距 1.45、窗台 0.55、窗顶 3.5，组中心保持 -2.05）
const WIN = { centers: [-3.5, -2.05, -0.6], width: 1.2, y0: 0.55, y1: 3.5, arch: true };
const WIN_X = WIN.centers.map((c) => [c - WIN.width / 2, c + WIN.width / 2]);
// 南墙（房屋前立面）：只有一扇大门（居中）+ 门两侧各一扇拱窗——与外壳西翼
// F1 前立面一致（户外看 = 1 门 2 窗，W8/W10 门脸拱窗宽 0.87；房内 sill 0.55 / 顶 2.45）
const S_WIN = { centers: [-2.8, 2.8], width: 0.87, y0: 0.55, y1: 2.45 };
const S_WIN_X = S_WIN.centers.map((c) => [c - S_WIN.width / 2, c + S_WIN.width / 2]);
// 客卫/厨房门在西墙（进门右手边：外壳西大门在立面偏左，进门面朝屋内时
// 通往中厅/厨房的门应在右手侧；西墙 z 0..12 无楼梯占用）
const SIDE_DOORS = [1.6, 4.3];   // 门中心 z（门洞宽 1.0 高 2.1）
// 楼梯：东墙（x 3.9..5.0 宽 1.1），z 5.9 起步向北爬 17 步到 y=3.0，顶部接平台薄板
// （平台高度 = 二楼标高 3.0，与层高 H 解耦——H 抬高后平台/触发区/落点不变）
const ST = {
    x0: 3.9, z0: 5.9, steps: 17, top: 3.0,
    tread: 0.28, rise: 3.0 / 17,
    landingZ0: 5.9 + 17 * 0.28,    // = 10.66：第 17 步之后接平台
};
// 挑高井道（楼梯上段上方）：西墙 x 3.75..3.85、南墙 z 7.35..7.45，
// base 3.0（平台层，不随 H 走）→ top 5.2 + 顶盖；井道墙骑跨天花板井口边
const SHAFT = { x0: 3.75, z0: 7.35, base: 3.0, top: 5.2 };
// 天花板井口 = 井道 footprint（x 3.8..5.1, z 7.4..12.1，井道墙骑跨井口边）
const HOLE = { x0: 3.8, x1: W / 2 + WT, z0: 7.4, z1: D + WT };
// 井道北墙顶部门洞（平台层，通往二楼的暗门洞；1.0 宽——障碍膨胀后仍剩 ≥4 格通道）
const TOP_DOOR = { x0: 4.0, x1: 5.0, y1: 5.0 };

// ── 材质（平涂：rough=1 metal=0）；结构色统一取 tools/room_palette.mjs ──
// 内墙/天花板用独立材质名（_interior）：inkwash 按材质名挂变体，
// 与外墙 MAT_wall 的灰泥质感区分开（室内墙纸 / 平滑顶面）
const MATS = {
    MAT_wall_interior: '#B4C7CE',       // 内墙：雾霾蓝（2026-09-10 应要求从豆绿 #B5C9A4 换冷色，与浅蓝顶同色系）
    MAT_ceiling_interior: '#B7D6E8',    // 天花板：浅蓝
    MAT_floor_wood: PALETTE.floorWood, // 木地板：inkwash floor 变体画拼缝+木纹
    MAT_frame: PALETTE.frame,
    MAT_door: PALETTE.door,
    MAT_window_view: PALETTE.windowView,   // 窗景片：时间系统按名联动变色
    MAT_curtain: '#E9E0C9',     // 窗帘：亚麻米白（inkwash curtain 变体画竖褶）
    MAT_stairs: '#C09A6B',     // WALK 逻辑面（隐藏，不进画面）
    MAT_tread: '#8A5A3B',      // 悬臂踏步板 + 平台面（胡桃木，同门板色系；inkwash wood 变体）
    MAT_railing: '#6E4B32',    // 西缘细栏杆（深胡桃，同门窗框色系；inkwash wood 变体）
    MAT_stairwell: '#14100C',  // 顶部门洞暗龛
};

// 窗帘（北墙）：整面一副帘盖过 3 拱窗（南墙门脸两窗的帘见下方 addCurtain 循环）
const CURTAIN = {
    x0: WIN_X[0][0] - 0.27,                       // 帘布左缘（比窗组宽出一点）
    x1: WIN_X[WIN_X.length - 1][1] + 0.27,
    y0: 0.42, y1: 3.62,                            // 垂到窗台下 → 帘杆下
    z0: D - 0.12, z1: D - 0.06,                    // 挂在墙内面（z=D）前方
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

// ── 房间建模 ──
const parts = [];   // { name, mat, extras?, translation?, part }
function add(name, mat, build, extras = null, translation = null) {
    const part = makePart();
    build(part);
    parts.push({ name, mat, extras, translation, part });
}

// 可见地板
add('FLOOR_visible', 'MAT_floor_wood', (p) => pushBox(p, [-W / 2, -0.06, 0], [W / 2, 0, D]));

// WALK 逻辑面（抬高 0.015）：主地板让开楼梯带（x>3.85, z>0.05）；
// 楼梯带整条铺面——低矮踏步下由净空规则自动剔除（nav_no_inflate 障碍），
// 只留高段踏步下方和平台壁龛可走；楼梯每步顶面 + 顶部平台各铺一片——导航只认这些面
add('WALK_floor', 'MAT_floor_wood', (p) => {
    pushQuadXZ(p, -W / 2 + 0.05, 0.05, ST.x0 - 0.05, D - 0.05, 0.015);          // 主地板
    pushQuadXZ(p, ST.x0 - 0.05, 0.05, W / 2 - 0.05, D - 0.05, 0.015);           // 楼梯带（含梯下/壁龛）
}, { surface_walkable: true });
add('WALK_stairs', 'MAT_stairs', (p) => {
    for (let k = 1; k <= ST.steps; k++) {
        const z0 = ST.z0 + (k - 1) * ST.tread;
        // 首步向南伸出 0.05 与地板条交叠（西缘栏板挡了侧向，登步走南侧）；
        // x 向西伸出 0.1 与地板面交叠（否则 5cm 缝隙卡走位的格子采样）
        pushQuadXZ(p, ST.x0 - 0.1, k === 1 ? z0 - 0.05 : z0, W / 2 - 0.05, z0 + ST.tread, k * ST.rise + 0.015);
    }
    // 顶部平台（向北延伸进顶部门洞暗龛；传送在走到门前触发）
    pushQuadXZ(p, ST.x0 - 0.05, ST.landingZ0, W / 2 - 0.05, D + 0.3, ST.top + 0.015);
}, {
    surface_walkable: true,
    // 点击楼梯任意处 → walker.js 把目标改写为梯顶门洞口（自动上楼；在梯顶反点不触发）
    stairs_to: [(TOP_DOOR.x0 + TOP_DOOR.x1) / 2, 3.02, D + 0.05],
});

// 墙体（南墙 1 大门 + 门两侧 2 拱窗；北墙 3 拱窗；西墙客卫/厨房两门洞）
add('WALLS', 'MAT_wall_interior', (p) => {
    const xw = W / 2;
    // 南墙（z=0：居中门洞 + S_WIN 两拱窗洞，与户外前立面 1 门 2 窗一致）
    pushWallX(p, -WT, 0, -xw, xw, H, [
        { a0: -DOOR_W / 2, a1: DOOR_W / 2, y0: 0, y1: DOOR_H },
        ...S_WIN_X.map(([a0, a1]) => ({ a0, a1, y0: S_WIN.y0, y1: S_WIN.y1, arch: true })),
    ]);
    // 北墙（z=D：3 拱窗洞，无门洞；井道 footprint 处在平台层以上开豁口，
    // 豁口里的是井道北墙及其顶部门洞——否则 4.5m 实墙会把门洞封死）
    pushWallX(p, D, D + WT, -xw, xw, H, [
        ...WIN_X.map(([a0, a1]) => ({ a0, a1, y0: WIN.y0, y1: WIN.y1, arch: true })),
        { a0: SHAFT.x0, a1: xw, y0: ST.top, y1: H },
    ]);
    // 西墙：客卫/厨房两门洞（进门右手边——外壳西大门在立面偏左，
    // 进门面向屋内时通往中厅/东翼的门应在右手侧）
    pushWallZ(p, -xw - WT, -xw, -WT, D + WT, H,
        SIDE_DOORS.map((c) => ({ a0: c - DOOR_W / 2, a1: c + DOOR_W / 2, y0: 0, y1: DOOR_H })));
    // 东墙：井道段（z ≥ SHAFT.z0）只砌到平台层，上面由井道东墙接住（避免共面重叠）
    pushBox(p, [xw, 0, -WT], [xw + WT, H, SHAFT.z0]);
    pushBox(p, [xw, 0, SHAFT.z0], [xw + WT, ST.top, D + WT]);
});

// 天花板（楼梯上段上方开井口，井口向上接挑高井道）
add('CEILING', 'MAT_ceiling_interior', (p) => {
    pushBox(p, [-W / 2 - WT, H, -WT], [W / 2 + WT, H + 0.12, HOLE.z0]);   // 南侧整板
    pushBox(p, [-W / 2 - WT, H, HOLE.z0], [HOLE.x0, H + 0.12, D + WT]);   // 井口西条
});
// 挑高井道（y 3.0..5.2，base=平台层不随层高走：西/南/东墙 + 北墙顶部门洞 + 顶盖；
// 楼梯全程净空 ≥2m）
add('SHAFT', 'MAT_wall_interior', (p) => {
    pushBox(p, [SHAFT.x0, SHAFT.base, SHAFT.z0], [SHAFT.x0 + WT, SHAFT.top, D + WT]);       // 西墙
    pushBox(p, [SHAFT.x0, SHAFT.base, SHAFT.z0], [W / 2 + WT, SHAFT.top, SHAFT.z0 + WT]);   // 南墙
    pushBox(p, [W / 2, SHAFT.base, SHAFT.z0], [W / 2 + WT, SHAFT.top, D + WT]);             // 东墙（接房间东墙）
    pushBox(p, [SHAFT.x0, SHAFT.base, D], [TOP_DOOR.x0, SHAFT.top, D + WT]);                // 北墙·门洞西
    pushBox(p, [TOP_DOOR.x1, SHAFT.base, D], [W / 2 + WT, SHAFT.top, D + WT]);              // 北墙·门洞东
    pushBox(p, [TOP_DOOR.x0, TOP_DOOR.y1, D], [TOP_DOOR.x1, SHAFT.top, D + WT]);            // 门洞过梁
    pushBox(p, [SHAFT.x0 - 0.05, SHAFT.top, SHAFT.z0 - 0.05],
               [W / 2 + WT + 0.05, SHAFT.top + 0.15, D + WT + 0.05]);                       // 顶盖
});
// 顶部门洞暗龛（从门洞看 = "通往二楼的黑暗"；传送触发区在门洞处）
add('STAIRWELL', 'MAT_stairwell', (p) =>
    pushBox(p, [TOP_DOOR.x0 - 0.05, SHAFT.base - 0.05, D + WT],
               [TOP_DOOR.x1 + 0.05, TOP_DOOR.y1 + 0.1, D + WT + 0.5]),
    { nav_ignore: true });

// 门框 + 窗框（含十字窗棂、窗台板）
// 注意：凡是与墙洞边共面的框面都要错开 E=8mm——深色框和浅色墙贴在同一平面上
// 会 z-fighting（相机一动窗框就闪；MSAA 治不了深度平局）。内边探进洞 E，
// 入墙的端面保持藏在墙体内
add('FRAMES', 'MAT_frame', (p) => {
    const j = 0.06;   // 框条宽
    const E = 0.008;  // 共面错开量
    const xw = W / 2;
    // 南墙大门门框（凸出墙面两侧各 0.02）
    {
        const x0 = -DOOR_W / 2, x1 = DOOR_W / 2;
        pushBox(p, [x0 - j, 0, -WT - 0.02], [x0 + E, DOOR_H + j, 0.02]);
        pushBox(p, [x1 - E, 0, -WT - 0.02], [x1 + j, DOOR_H + j, 0.02]);
        pushBox(p, [x0 - j, DOOR_H - E, -WT - 0.02], [x1 + j, DOOR_H + j, 0.02]);
    }
    // 西墙客卫/厨房门框（沿 z 墙，凸出墙面两侧各 0.02）
    for (const c of SIDE_DOORS) {
        const z0 = c - DOOR_W / 2, z1 = c + DOOR_W / 2;
        pushBox(p, [-xw - WT - 0.02, 0, z0 - j], [-xw + 0.02, DOOR_H + j, z0 + E]);
        pushBox(p, [-xw - WT - 0.02, 0, z1 - E], [-xw + 0.02, DOOR_H + j, z1 + j]);
        pushBox(p, [-xw - WT - 0.02, DOOR_H - E, z0 - j], [-xw + 0.02, DOOR_H + j, z1 + j]);
    }
    // 窗框（拱窗：边框到起拱线 + 拱顶踏步框 + 矩形段十字棂 + 窗台板）
    // f = 墙房内侧面 z，o = 出房方向（北墙 +1 / 南墙 -1）
    const winFrame = (x0, x1, y0, y1, f, o) => {
        const z0 = Math.min(f - o * 0.03, f + o * (WT + 0.03));
        const z1 = Math.max(f - o * 0.03, f + o * (WT + 0.03));
        const m0 = Math.min(f, f + o * WT), m1 = Math.max(f, f + o * WT);   // 棂在墙体内
        const sz0 = Math.min(f - o * 0.07, z1), sz1 = Math.max(f - o * 0.07, z0); // 窗台板探入房 0.04
        const ys = y1 - 0.3;   // 起拱线
        const j2 = 0.06;
        pushBox(p, [x0 - j2, y0 - j2, z0], [x0 + E, ys + j2, z1]);   // 边框
        pushBox(p, [x1 - E, y0 - j2, z0], [x1 + j2, ys + j2, z1]);
        pushBox(p, [x0 - j2 - 0.02, y0 - j2 - 0.04, sz0], [x1 + j2 + 0.02, y0 + E, sz1]); // 窗台板
        const cx = (x0 + x1) / 2, cy = (y0 + ys) / 2, m = 0.028;   // 棂半宽（0.056 全宽≈框条，太细会亚像素闪）
        pushBox(p, [cx - m, y0 + E, m0], [cx + m, ys - E, m1]);   // 竖棂（矩形段）
        pushBox(p, [x0 + E, cy - m, m0], [x1 - E, cy + m, m1]);   // 横棂
        // 拱顶框：起拱线横梁 + 两级踏步边梃 + 顶梁
        const w = x1 - x0, hw1 = w * 0.7 / 2, hw2 = w * 0.35 / 2;
        pushBox(p, [x0 - j2, ys - E, z0], [x1 + j2, ys + j2, z1]);
        pushBox(p, [cx - hw1 - j2, ys - E, z0], [cx - hw1 + E, ys + 0.15 - E, z1]);
        pushBox(p, [cx + hw1 - E, ys - E, z0], [cx + hw1 + j2, ys + 0.15 - E, z1]);
        pushBox(p, [cx - hw2 - j2, ys + 0.15 - E, z0], [cx - hw2 + E, y1 - E, z1]);
        pushBox(p, [cx + hw2 - E, ys + 0.15 - E, z0], [cx + hw2 + j2, y1 - E, z1]);
        pushBox(p, [cx - hw2 - j2, y1 - E, z0], [cx + hw2 + j2, y1 + j2, z1]);
    };
    for (const [x0, x1] of WIN_X) winFrame(x0, x1, WIN.y0, WIN.y1, D, 1);       // 北墙 3 拱窗
    for (const [x0, x1] of S_WIN_X) winFrame(x0, x1, S_WIN.y0, S_WIN.y1, 0, -1); // 南墙门脸 2 拱窗
});

// 窗景片（北墙外侧大面片，时间系统按材质名联动变色）
add('VIEW_window', 'MAT_window_view', (p) =>
    pushBox(p, [WIN_X[0][0] - 0.4, WIN.y0 - 0.25, D + 0.4],
               [WIN_X[WIN_X.length - 1][1] + 0.4, WIN.y1 + 0.25, D + 0.46]),
    { nav_ignore: true });

// 南墙门脸窗景片（南墙外侧大面片；也在大门洞后，开门一瞬看到"天色"而不是虚空）
add('VIEW_window_s', 'MAT_window_view', (p) =>
    pushBox(p, [S_WIN_X[0][0] - 0.4, S_WIN.y0 - 0.25, -0.46],
               [S_WIN_X[S_WIN_X.length - 1][1] + 0.4, S_WIN.y1 + 0.25, -0.40]),
    { nav_ignore: true });

// 窗帘：北墙整面一副 + 南墙门脸两窗各一副。两片帘布 origin 各在**外侧边缘**，
// 开帘 = JS 端 scale.x 1→0.12 向两侧收拢成褶（doors.js，kind='curtain'）；
// 同 curtain_group 的帘片联动；nav_ignore：纯视觉/交互物，不进导航也不算障碍
function addCurtain({ x0, x1, y0, y1, rodY, z0, z1, group }) {
    add(`CURTAIN_ROD_${group}`, 'MAT_frame', (p) => {
        pushBox(p, [x0 - 0.08, rodY - 0.03, z0 - 0.01],
                   [x1 + 0.08, rodY + 0.03, z1 + 0.01]);   // 横杆
        pushBox(p, [x0 - 0.13, rodY - 0.05, z0 - 0.03],
                   [x0 - 0.06, rodY + 0.05, z1 + 0.03]);   // 端头球（方）
        pushBox(p, [x1 + 0.06, rodY - 0.05, z0 - 0.03],
                   [x1 + 0.13, rodY + 0.05, z1 + 0.03]);
    }, { nav_ignore: true });
    const half = (x1 - x0) / 2;
    const extras = { interactable_type: 'curtain', curtain_group: group, nav_ignore: true };
    // 左片：origin 在左缘（几何向右伸展），收拢时往左堆
    add(`CURTAIN_L_${group}`, 'MAT_curtain', (p) =>
        pushBox(p, [0, y0, z0], [half, y1, z1]), extras, [x0, 0, 0]);
    // 右片：origin 在右缘（几何向左伸展），收拢时往右堆
    add(`CURTAIN_R_${group}`, 'MAT_curtain', (p) =>
        pushBox(p, [-half, y0, z0], [0, y1, z1]), extras, [x1, 0, 0]);
}
// 北墙：整面一副帘盖过 3 拱窗
addCurtain({ x0: CURTAIN.x0, x1: CURTAIN.x1, y0: CURTAIN.y0, y1: CURTAIN.y1,
             rodY: 3.63, z0: CURTAIN.z0, z1: CURTAIN.z1, group: 'north' });
// 南墙门脸 2 拱窗：每窗一副（中间隔着大门，不能共享）
for (const [i, c] of S_WIN.centers.entries()) {
    addCurtain({
        x0: c - S_WIN.width / 2 - 0.27, x1: c + S_WIN.width / 2 + 0.27,
        y0: 0.42, y1: 2.55, rodY: 2.60,
        z0: 0.06, z1: 0.12,   // 挂在南墙内面（z=0）前方
        group: `south_${i}`,
    });
}

// 楼梯可见梯体：悬空梯——0.07 厚悬臂踏步板（东端插进东墙，梯下完全挑空），
// 顶部平台 0.15 薄板。踏步是障碍（低矮踏步下不让人进）但 nav_no_inflate：
// 膨胀会把上一级踏步的净空判定扩散到下一级格上（见 pathfinding.js 注释）
add('STAIRS', 'MAT_tread', (p) => {
    for (let k = 1; k <= ST.steps; k++) {
        const z0 = ST.z0 + (k - 1) * ST.tread, top = k * ST.rise;
        pushBox(p, [ST.x0 - 0.02, top - 0.07, z0], [W / 2, top, z0 + ST.tread]);   // 悬臂踏步板
    }
    pushBox(p, [ST.x0 - 0.05, ST.top - 0.15, ST.landingZ0], [W / 2 + 0.05, ST.top, D + 0.05]); // 平台薄板（y=3.0，不随层高走）
}, { nav_no_inflate: true });

// 西缘细栏杆（每步一根立柱 + 踏步式细扶手，扶手高 0.8；障碍，导航按净空绕行）
add('RAILING', 'MAT_railing', (p) => {
    for (let k = 1; k <= ST.steps; k++) {
        const z0 = ST.z0 + (k - 1) * ST.tread, top = k * ST.rise;
        pushBox(p, [ST.x0 - 0.04, top, z0 + 0.11], [ST.x0 + 0.01, top + 0.72, z0 + 0.16]);   // 立柱
        pushBox(p, [ST.x0 - 0.06, top + 0.72, z0], [ST.x0 + 0.04, top + 0.82, z0 + ST.tread]); // 扶手
    }
});

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

// 西墙两扇传送门（客卫/厨房）：门板沿 z 伸展，origin 在南侧铰链边（z=门洞南缘），
// dir right=+1 → rotation.y = +90° → 门板从 +z 转向 +x（屋内）
add('DOOR_bath', 'MAT_door', (p) => pushBox(p, [-0.02, 0, 0], [0.02, 2.06, 0.96]),
    {
        interactable_type: 'door',
        door_swing_angle: 90.0,
        door_swing_dir: 'right',
        door_slide: false,
        door_locked: false,
        door_target_scene: 'f1_bath',
        door_target_spawn: 'default',
    },
    [-W / 2, 0.02, SIDE_DOORS[0] - 0.48]);
add('DOOR_kitchen', 'MAT_door', (p) => pushBox(p, [-0.02, 0, 0], [0.02, 2.06, 0.96]),
    {
        interactable_type: 'door',
        door_swing_angle: 90.0,
        door_swing_dir: 'right',
        door_slide: false,
        door_locked: false,
        door_target_scene: 'f1_kitchen',
        door_target_spawn: 'default',
    },
    [-W / 2, 0.02, SIDE_DOORS[1] - 0.48]);

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
