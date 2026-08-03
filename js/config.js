/**
 * 场景常量配置（精简版）
 */

// 背景色
export const BG_COLOR    = 0x87a5c0;   // 中午明亮天空

// 相机默认参数
export const CAMERA_FOV     = 50;
export const CAMERA_NEAR    = 0.1;
export const CAMERA_FAR     = 120;
export const CAMERA_POS     = { x: 0.5, y: 3.5, z: 6 };
export const CAMERA_TARGET  = { x: -4, y: 1.2, z: 0 };

// 轨道控制器
export const ORBIT_DAMPING       = 0.05;
export const ORBIT_MIN_DISTANCE  = 2;
export const ORBIT_MAX_DISTANCE  = 60;
export const ORBIT_MAX_POLAR     = Math.PI * 0.85;
export const CAMERA_FOLLOW_SPEED = 3;
export const CAMERA_FOLLOW_Y     = 1.2;
export const MAX_PIXEL_RATIO     = 2;

// ── 相机区域机位（区域相机 + 限定范围轨道，见 systems/cameraZones.js）──
// 注意坐标系为 three.js（y 向上）：Blender(x,y,z) 对应 three(x, z, -y)
// bounds 为角色自动切换的触发范围（three 坐标），null = 仅手动切换
// 室内机位用 minPolar/maxPolar/maxDist 把轨道限制在房间内，转不出去
// 机位分组（UI 按组折叠展示，见 systems/cameraZones.js）
export const CAMERA_ZONE_CATEGORIES = [
    { id: 'outside', name: '室外', nameEn: 'Outdoor' },
    { id: 'attic',   name: '阁楼', nameEn: 'Attic'   },
    { id: 'f1',      name: '一楼', nameEn: '1st Floor' },
    { id: 'f2',      name: '二楼', nameEn: '2nd Floor' },
];

export const CAMERA_ZONES = [
    { id: 'overview', name: '全景', nameEn: 'Overview', category: 'outside',
      pos: [13, 11, 15], target: [0, 2, 0],
      minDist: 4, maxDist: 40, maxPolar: Math.PI * 0.49,
      bounds: null },
    { id: 'courtyard', name: '庭院', nameEn: 'Courtyard', category: 'outside',
      pos: [0, 3.2, 9.5], target: [0, 1.2, 2],
      minDist: 2, maxDist: 12, maxPolar: Math.PI * 0.49,
      bounds: { x: [-3.5, 3.5], z: [0.9, 5.5] } },
    { id: 'back', name: '背面', nameEn: 'Back', category: 'outside',
      pos: [0, 5.5, -15], target: [0, 3, -4],
      minDist: 3, maxDist: 22, maxPolar: Math.PI * 0.49,
      bounds: { x: [-11, 11], z: [-20, -5.5] } },

    // ── 阁楼（z 6.2~11.4，坡顶）──
    { id: 'attic1', name: '阁楼1', nameEn: 'Attic 1', category: 'attic',
      pos: [4, 8.6, -1], target: [-5, 7.2, 2.5],
      minDist: 0.8, maxDist: 11, minPolar: Math.PI * 0.25, maxPolar: Math.PI * 0.7,
      bounds: null },
    { id: 'attic2', name: '阁楼2', nameEn: 'Attic 2', category: 'attic',
      pos: [-4, 8.6, -1], target: [5, 7.2, 2.5],
      minDist: 0.8, maxDist: 11, minPolar: Math.PI * 0.25, maxPolar: Math.PI * 0.7,
      bounds: null },
    { id: 'attic3', name: '阁楼3', nameEn: 'Attic 3', category: 'attic',
      pos: [0, 8.2, -3.5], target: [0, 7.2, 4.5],
      minDist: 0.8, maxDist: 9, minPolar: Math.PI * 0.25, maxPolar: Math.PI * 0.7,
      bounds: null },
    { id: 'attic4', name: '阁楼4', nameEn: 'Attic 4', category: 'attic',
      pos: [-6.5, 7.5, 3.5], target: [6.5, 8.5, -3],
      minDist: 0.8, maxDist: 15, minPolar: Math.PI * 0.25, maxPolar: Math.PI * 0.7,
      bounds: null },

    // ── 一楼（z 0~3，翼间 x±(3.6~9.4)， z -4.9~3.9）──
    { id: 'f1w1', name: '一楼西1', nameEn: '1F W1', category: 'f1',
      pos: [-4.3, 1.7, 3.0], target: [-7.8, 1.1, -2.5],
      minDist: 0.5, maxDist: 7, minPolar: Math.PI * 0.35, maxPolar: Math.PI * 0.65,
      bounds: null },
    { id: 'f1w2', name: '一楼西2', nameEn: '1F W2', category: 'f1',
      pos: [-8.6, 1.7, -3.5], target: [-5.0, 1.2, 2.5],
      minDist: 0.5, maxDist: 8, minPolar: Math.PI * 0.35, maxPolar: Math.PI * 0.65,
      bounds: null },
    { id: 'f1e1', name: '一楼东1', nameEn: '1F E1', category: 'f1',
      pos: [4.3, 1.7, 3.0], target: [7.8, 1.1, -2.5],
      minDist: 0.5, maxDist: 7, minPolar: Math.PI * 0.35, maxPolar: Math.PI * 0.65,
      bounds: null },
    { id: 'f1e2', name: '一楼东2', nameEn: '1F E2', category: 'f1',
      pos: [8.6, 1.7, -3.5], target: [5.0, 1.2, 2.5],
      minDist: 0.5, maxDist: 8, minPolar: Math.PI * 0.35, maxPolar: Math.PI * 0.65,
      bounds: null },
    { id: 'f1c', name: '一楼中', nameEn: '1F C', category: 'f1',
      pos: [0, 1.7, 0.5], target: [0, 1.2, -4],
      minDist: 0.5, maxDist: 8.5, minPolar: Math.PI * 0.35, maxPolar: Math.PI * 0.65,
      bounds: null },

    // ── 二楼（z 3.1~6.1）──
    { id: 'f2w1', name: '二楼西1', nameEn: '2F W1', category: 'f2',
      pos: [-4.3, 4.8, 3.0], target: [-7.8, 4.2, -2.5],
      minDist: 0.5, maxDist: 7, minPolar: Math.PI * 0.35, maxPolar: Math.PI * 0.65,
      bounds: null },
    { id: 'f2w2', name: '二楼西2', nameEn: '2F W2', category: 'f2',
      pos: [-8.6, 4.8, -3.5], target: [-5.0, 4.3, 2.5],
      minDist: 0.5, maxDist: 8, minPolar: Math.PI * 0.35, maxPolar: Math.PI * 0.65,
      bounds: null },
    { id: 'f2e1', name: '二楼东1', nameEn: '2F E1', category: 'f2',
      pos: [4.3, 4.8, 3.0], target: [7.8, 4.2, -2.5],
      minDist: 0.5, maxDist: 7, minPolar: Math.PI * 0.35, maxPolar: Math.PI * 0.65,
      bounds: null },
    { id: 'f2e2', name: '二楼东2', nameEn: '2F E2', category: 'f2',
      pos: [8.6, 4.8, -3.5], target: [5.0, 4.3, 2.5],
      minDist: 0.5, maxDist: 8, minPolar: Math.PI * 0.35, maxPolar: Math.PI * 0.65,
      bounds: null },
    { id: 'f2c', name: '二楼中', nameEn: '2F C', category: 'f2',
      pos: [0, 4.8, 0.5], target: [0, 4.3, -4],
      minDist: 0.5, maxDist: 8.5, minPolar: Math.PI * 0.35, maxPolar: Math.PI * 0.65,
      bounds: null },
];
export const CAMERA_ZONE_TRANSITION = 0.9;   // 机位切换过渡时长（秒）
export const CAMERA_FOLLOW_DEADZONE = 2.5;   // 跟随死区：角色离 target 超过此距离才跟随

// ── 场景注册表（动森式独立场景切换，见 systems/sceneManager.js）──
// 每场景：独立 glb 内容 + 机位表 + 落点表；门 = 传送点
// （门 extras: door_target_scene / door_target_spawn）
// spawns 的 pos 为 three 坐标 [x,y,z]，rotY 为落地朝向（弧度）
// ── 客厅机位（f1_living：房间 6×5×2.7m，原点在门口地板中心）──
// 斜 45° 俯看全屋，轨道距离/俯仰锁小范围，转不出房间
const LIVING_ZONES = [
    { id: 'living_main', name: '客厅', nameEn: 'Living', category: 'room',
      pos: [-2.2, 2.2, 1.0], target: [0.8, 0.6, 3.4],
      minDist: 1.2, maxDist: 5, maxPolar: Math.PI * 0.49,
      bounds: null },
    { id: 'living_window', name: '客厅·窗', nameEn: 'Living N', category: 'room',
      pos: [2.3, 2.1, 4.4], target: [-1.4, 0.7, 1.0],
      minDist: 1.2, maxDist: 6, maxPolar: Math.PI * 0.49,
      bounds: null },
];
const LIVING_ZONE_CATEGORIES = [
    { id: 'room', name: '房间', nameEn: 'Room' },
];

// ── 房间场景模板（阶段 5：11 间房共用）──
// 单主机位：斜 45° 俯看全屋；光照：无直射阳光、窗光主光源、夜间顶灯
// winLight: 窗光位姿（窗外 2m 照向屋内），spawns 见各房间连接表
function roomScene({ id, name, nameEn, glb, w, d, h, spawns, winLight }) {
    return {
        id, name, nameEn,
        glbs: [glb],
        zones: [{
            id: `${id}_main`, name, nameEn, category: 'room',
            pos: [-w * 0.35, h * 0.82, d * 0.16], target: [w * 0.18, 0.6, d * 0.66],
            minDist: 1.0, maxDist: Math.max(w, d) * 1.1, maxPolar: Math.PI * 0.49,
            bounds: null,
        }],
        categories: LIVING_ZONE_CATEGORIES,
        spawns,
        lighting: {
            sun: 0,
            ambient: 0.75,
            spot: 1.3,
            windowLight: winLight,
            lamp: {
                position: [0, h - 0.3, d / 2], color: 0xFFD9A0,
                intensity: 1.6, distance: Math.max(w, d) * 1.4,
            },
        },
    };
}
// 北窗房间的窗光（wxc = 窗洞中心 x）
const winN = (wxc, d) => ({ position: [wxc, 2.0, d + 2.0], target: [wxc, 0.4, d * 0.45] });
// spawn 简写：S 门到达（面朝 +z）/ N 门到达（面朝 -z）
const spS = (x) => ({ pos: [x, 0.02, 0.9], rotY: 0 });
const spN = (x, d) => ({ pos: [x, 0.02, d - 0.9], rotY: Math.PI });
const ROOM_SCENES = [
    roomScene({ id: 'f1_kitchen', name: '厨房', nameEn: 'Kitchen', glb: 'models/room_kitchen.glb',
        w: 7, d: 5, h: 2.7, winLight: winN(-0.85, 5),
        spawns: { default: spS(0), fromOutdoor: spN(2.2, 5) } }),
    roomScene({ id: 'f1_bath', name: '客卫', nameEn: 'Bathroom', glb: 'models/room_bath_f1.glb',
        w: 2.5, d: 2.5, h: 2.4, winLight: winN(0, 2.5),
        spawns: { default: spS(0) } }),
    roomScene({ id: 'f2_study', name: '学习室', nameEn: 'Study', glb: 'models/room_study.glb',
        w: 6, d: 6, h: 2.7,
        winLight: { position: [1.95, 2.0, -2.0], target: [1.95, 0.4, 3.0] },   // 南窗
        spawns: {
            default: spS(0),          // 客厅楼梯上来
            fromBed2: spS(-2),
            fromBed1: spN(-2, 6), fromBed3: spN(0, 6), fromAtticA: spN(2, 6),
        } }),
    ...[1, 2, 3].map((n) => roomScene({
        id: `f2_bed${n}`, name: `卧室${n}`, nameEn: `Bedroom ${n}`, glb: `models/room_bed${n}.glb`,
        w: 5, d: 4.5, h: 2.7, winLight: winN(1.3, 4.5),
        spawns: { default: spS(0), fromBath: { pos: [-1.5, 0.02, 3.8], rotY: Math.PI } } })),
    ...[1, 2, 3].map((n) => roomScene({
        id: `f2_bath${n}`, name: `卫生间${n}`, nameEn: `Bathroom ${n}`, glb: `models/room_bath${n}.glb`,
        w: 2.5, d: 2.5, h: 2.4, winLight: winN(0, 2.5),
        spawns: { default: spS(0) } })),
    roomScene({ id: 'attic_game_a', name: '游戏室A', nameEn: 'Game Room A', glb: 'models/room_game_a.glb',
        w: 6, d: 5, h: 2.4, winLight: winN(-1.55, 5),
        spawns: { default: spS(0), fromStudy: spS(0), fromGameB: spN(1.8, 5) } }),
    roomScene({ id: 'attic_game_b', name: '游戏室B', nameEn: 'Game Room B', glb: 'models/room_game_b.glb',
        w: 5, d: 4.5, h: 2.4, winLight: winN(0, 4.5),
        spawns: { default: spS(0) } }),
];

export const SCENES = [
    { id: 'outdoor', name: '室外', nameEn: 'Outdoor',
      zones: CAMERA_ZONES, categories: CAMERA_ZONE_CATEGORIES,
      spawns: {
          default: { pos: [-4, 0, 0], rotY: -0.4 },
          // 西大门外（客厅出口门的落点）：背向房子面朝花园
          houseWest: { pos: [-6.5, 0, 5.6], rotY: 0 },
          // 东大门外（厨房出口门的落点）
          houseEast: { pos: [6.5, 0, 5.6], rotY: 0 },
      },
      // 室外无窗光/室内灯（旧内饰窗光已被黑内胆挡住，spot 归零）
      lighting: { spot: 0 } },
    { id: 'f1_living', name: '客厅', nameEn: 'Living Room',
      glbs: ['models/room_living.glb'],
      zones: LIVING_ZONES, categories: LIVING_ZONE_CATEGORIES,
      spawns: {
          // 从室外大门进入：门内一步，面朝房间（+z）
          default: { pos: [0, 0.02, 0.9], rotY: 0 },
          // 阶段 5：各房间回程落点（南墙客卫/厨房门、北墙楼梯门）
          fromBath: { pos: [-1.8, 0.02, 0.9], rotY: 0 },
          fromKitchen: { pos: [1.8, 0.02, 0.9], rotY: 0 },
          fromStudy: { pos: [1.3, 0.02, 4.1], rotY: Math.PI },
      },
      // 室内光照（timeOfDay.setSceneProfile）：无直射阳光，窗光为主光源，
      // 夜晚开顶灯；窗在北墙（z=5），灯在天花板 LAMP 吊灯下方
      lighting: {
          sun: 0,
          ambient: 0.75,
          spot: 1.3,
          windowLight: { position: [0, 2.2, 7.5], target: [0, 0.4, 2.0] },
          lamp: { position: [0, 2.4, 2.5], color: 0xFFD9A0, intensity: 1.6, distance: 7 },
      } },
    ...ROOM_SCENES,
];

// 渲染器参数
export const TONE_MAPPING_EXPOSURE = 1.1;

// 后期处理 — Bloom
export const BLOOM_STRENGTH  = 0.15;
export const BLOOM_RADIUS    = 0.6;
export const BLOOM_THRESHOLD = 0.85;

// 后期处理 — 三渲二描边（OutlinePass，见 systems/toon.js）
export const OUTLINE_STRENGTH  = 2.5;
export const OUTLINE_THICKNESS = 1.0;
export const OUTLINE_COLOR     = '#4a3f35';   // 深棕，比纯黑柔和

// 点击检测（拖动 vs 点击阈值，px）
export const CLICK_DRAG_THRESHOLD = 5;

// ── 灯光系统 ──

// 环境光
export const AMBIENT_LIGHT_COLOR     = 0xf0f0f0;
export const AMBIENT_LIGHT_INTENSITY = 0.5;

// 主方向光（太阳）
export const SUN_COLOR      = 0xffeedd;
export const SUN_INTENSITY  = 1.8;
export const SUN_POSITION   = { x: 0, y: 0.5, z: -8 };
export const SUN_SHADOW_MAP_SIZE = 2048;
export const SUN_SHADOW_LEFT     = -6;
export const SUN_SHADOW_RIGHT    =  6;
export const SUN_SHADOW_TOP      =  5;
export const SUN_SHADOW_BOTTOM   = -5;
export const SUN_SHADOW_NEAR     =  0.1;
export const SUN_SHADOW_FAR      = 20;
export const SUN_SHADOW_RADIUS   = 6;
export const SUN_SHADOW_BIAS     = -0.0005;

// 补光
export const FILL_LIGHT_COLOR     = 0x8899bb;
export const FILL_LIGHT_INTENSITY = 0.3;
export const FILL_LIGHT_POSITION  = { x: -3, y: 4, z: -2 };

// 窗外聚光灯
export const WINDOW_SPOT_COLOR     = 0xfff0dd;
export const WINDOW_SPOT_INTENSITY = 2.0;
export const WINDOW_SPOT_DISTANCE  = 10;
export const WINDOW_SPOT_ANGLE     = Math.PI / 5;
export const WINDOW_SPOT_PENUMBRA  = 0.5;
export const WINDOW_SPOT_POSITION  = { x: 0.5, y: 2.5 };

// ── 一天时间系统 ──
export const SUN_ORBIT_RADIUS = 8;

// view = 窗景片/窗玻璃时段变色（MAT_window_view / MAT_window_glass，见 timeOfDay.js）
// lamp = 室内灯强度（场景配置 lamp 时生效，见 SCENES[*].lighting.lamp）
export const TIME_PRESETS = [
    { name: '清晨', nameEn: 'Dawn',   az: 100, el: 3,   h: 0.07, s: 0.9,  l: 0.55, sun: 0.6,  ambient: 0.15, fill: 0.1,  spot: 0.4,  bg: 0x3d2b4a, view: 0xE8A06A, lamp: 0.5 },
    { name: '早上', nameEn: 'Morning', az: 150, el: 20,  h: 0.11, s: 0.8,  l: 0.7,  sun: 1.2,  ambient: 0.25, fill: 0.2,  spot: 1.0,  bg: 0x7a8caa, view: 0x9FC8E8, lamp: 0 },
    { name: '中午', nameEn: 'Noon',    az: 180, el: 75,  h: 0.14, s: 0.3,  l: 0.95, sun: 2.0,  ambient: 0.4,  fill: 0.35, spot: 1.5,  bg: 0x87a5c0, view: 0xBFE3FF, lamp: 0 },
    { name: '下午', nameEn: 'Afternoon', az: 210, el: 30,  h: 0.10, s: 0.7,  l: 0.75, sun: 1.5,  ambient: 0.3,  fill: 0.25, spot: 1.2,  bg: 0x8a7060, view: 0xF0C88A, lamp: 0 },
    { name: '傍晚', nameEn: 'Dusk',    az: 225, el: 5,   h: 0.04, s: 1.0,  l: 0.5,  sun: 0.8,  ambient: 0.15, fill: 0.1,  spot: 0.6,  bg: 0x6b4455, view: 0xFF8A50, lamp: 1.0 },
    { name: '夜晚', nameEn: 'Night',   az: 180, el: -10, h: 0.6,  s: 0.3,  l: 0.1,  sun: 0,    ambient: 0.03, fill: 0.02, spot: 0,    bg: 0x0a0a1a, view: 0x10204A, lamp: 1.5 },
];

// ── 四季预设（草地 + 树叶颜色；秋→冬树叶缩放落叶，见 systems/seasons.js）──
export const SEASON_PRESETS = [
    { name: '春', nameEn: 'Spring', grass: 0x7acc68, leaves: 0x7cc46a },
    { name: '夏', nameEn: 'Summer', grass: 0x4a8c3f, leaves: 0x3e7c33 },
    { name: '秋', nameEn: 'Autumn', grass: 0xb8a040, leaves: 0xd08a3a },
    { name: '冬', nameEn: 'Winter', grass: 0xe8e8e8, leaves: 0xa07838 },
];
