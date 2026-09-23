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
export const ORBIT_DAMPING       = 0.1;    // 阻尼：松手后收敛更快，减少余滑发飘
export const ORBIT_ROTATE_SPEED  = 0.5;    // 旋转灵敏度（OrbitControls 默认 1.0 太快）
export const ORBIT_ZOOM_SPEED    = 0.7;
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
// 阶段 6：旧室内机位（attic/f1/f2 共 14 个，指向已被黑内胆封死的旧内饰）已删除，
// 室内一律走独立房间场景（SCENES 注册表）
export const CAMERA_ZONE_CATEGORIES = [
    { id: 'outside', name: '室外', nameEn: 'Outdoor' },
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
];
export const CAMERA_ZONE_TRANSITION = 0.9;   // 机位切换过渡时长（秒）
export const CAMERA_FOLLOW_DEADZONE = 2.5;   // 跟随死区：角色离 target 超过此距离才跟随

// ── 场景注册表（动森式独立场景切换，见 systems/sceneManager.js）──
// 每场景：独立 glb 内容 + 机位表 + 落点表；门 = 传送点
// （门 extras: door_target_scene / door_target_spawn）
// spawns 的 pos 为 three 坐标 [x,y,z]，rotY 为落地朝向（弧度）
// ── 客厅机位（f1_living：房间 10×12×4.5m 高厅，原点在门口地板中心）──
// 斜 45° 俯看全屋，轨道距离/俯仰锁小范围，转不出房间
const LIVING_ZONES = [
    { id: 'living_main', name: '客厅', nameEn: 'Living', category: 'room',
      pos: [-4.2, 2.7, 1.2], target: [1.2, 0.5, 6.5],
      minDist: 1.2, maxDist: 14, maxPolar: Math.PI * 0.49,
      bounds: null },
    { id: 'living_window', name: '客厅·窗', nameEn: 'Living N', category: 'room',
      // 东北角高位看西南（避开 +x 墙楼梯）
      pos: [3.2, 2.5, 10.5], target: [-2.0, 0.7, 2.0],
      minDist: 1.2, maxDist: 14, maxPolar: Math.PI * 0.49,
      bounds: null },
];
// 走廊机位（f1_corridor：3×12×3.2，南门口低位看北尽头客卫门，取纵深"深邃"感）
const CORRIDOR_ZONES = [
    { id: 'corridor_main', name: '走廊', nameEn: 'Corridor', category: 'room',
      pos: [0, 2.3, 0.7], target: [0, 1.3, 9.5],
      minDist: 1.0, maxDist: 10, maxPolar: Math.PI * 0.49,
      bounds: null },
];
// 二楼卧室机位（f2_bed1/2：10×12×4.5，与一楼大厅同尺寸同套路）；
// 卧室1 楼梯在 +x 墙（同客厅），卧室2 镜像（楼梯 -x 墙，机位 x 取反）
const BED1_ZONES = [
    { id: 'bed1_main', name: '卧室1', nameEn: 'Bedroom 1', category: 'room',
      pos: [-4.2, 2.7, 1.2], target: [1.2, 0.5, 6.5],
      minDist: 1.2, maxDist: 14, maxPolar: Math.PI * 0.49,
      bounds: null },
    { id: 'bed1_window', name: '卧室1·窗', nameEn: 'Bedroom 1 N', category: 'room',
      pos: [3.2, 2.5, 10.5], target: [-2.0, 0.7, 2.0],
      minDist: 1.2, maxDist: 14, maxPolar: Math.PI * 0.49,
      bounds: null },
];
const BED2_ZONES = [
    { id: 'bed2_main', name: '卧室2', nameEn: 'Bedroom 2', category: 'room',
      pos: [4.2, 2.7, 1.2], target: [-1.2, 0.5, 6.5],
      minDist: 1.2, maxDist: 14, maxPolar: Math.PI * 0.49,
      bounds: null },
    { id: 'bed2_window', name: '卧室2·窗', nameEn: 'Bedroom 2 N', category: 'room',
      pos: [-3.2, 2.5, 10.5], target: [2.0, 0.7, 2.0],
      minDist: 1.2, maxDist: 14, maxPolar: Math.PI * 0.49,
      bounds: null },
];
// F2 走廊机位（3×12×3.2，同一楼走廊套路）
const CORRIDOR_F2_ZONES = [
    { id: 'corridor_f2_main', name: '走廊', nameEn: 'Corridor', category: 'room',
      pos: [0, 2.3, 0.7], target: [0, 1.3, 9.5],
      minDist: 1.0, maxDist: 10, maxPolar: Math.PI * 0.49,
      bounds: null },
];
// 厨房机位（f1_kitchen：10×12×4.5 高厅，东墙楼梯；同客厅套路）
const KITCHEN_ZONES = [
    { id: 'kitchen_main', name: '厨房', nameEn: 'Kitchen', category: 'room',
      pos: [-4.2, 2.7, 1.2], target: [1.2, 0.5, 6.5],
      minDist: 1.2, maxDist: 14, maxPolar: Math.PI * 0.49,
      bounds: null },
    { id: 'kitchen_window', name: '厨房·窗', nameEn: 'Kitchen N', category: 'room',
      // 东北角高位看西南（楼梯在 -x 墙，不在镜头侧）
      pos: [3.2, 2.5, 10.5], target: [-2.0, 0.7, 2.0],
      minDist: 1.2, maxDist: 14, maxPolar: Math.PI * 0.49,
      bounds: null },
];
const LIVING_ZONE_CATEGORIES = [
    { id: 'room', name: '房间', nameEn: 'Room' },
];

// ── 房间场景模板（三楼 6 房共用；一楼 4 房与二楼 4 房均为定制条目）──
// 单主机位：斜 45° 俯看全屋；光照：无直射阳光、窗光主光源、夜间顶灯
// winLight: 窗光位姿（窗外 2m 照向屋内），spawns 见各房间连接表
// winless=true：无窗房（卫生间/游戏室/学习室/走廊）——无窗光、顶灯为主光源
// lampY：顶灯高度（坡顶房挂屋脊下方，缺省 h-0.3）
function roomScene({ id, name, nameEn, glb, glbs, w, d, h, spawns, winLight, mirrorZone = false, winless = false, zonePos = null, zoneTarget = null, lampY = null }) {
    const sx = mirrorZone ? 1 : -1;   // 家具偏西墙的房间（卧室）从东南角拍西北
    return {
        id, name, nameEn,
        glbs: glbs ?? [glb],
        zones: [{
            id: `${id}_main`, name, nameEn, category: 'room',
            // 南墙角高位俯拍对角：尽量一屏看全 7×7 房间全景（阁楼坡顶用 zonePos 压低机位）
            pos: zonePos ?? [sx * (w / 2 - 0.4), h * 0.88, 0.35],
            target: zoneTarget ?? [-sx * 1.0, 0.5, d * 0.62],
            minDist: 1.0, maxDist: Math.max(w, d) * 1.1, maxPolar: Math.PI * 0.49,
            bounds: null,
        }],
        categories: LIVING_ZONE_CATEGORIES,
        spawns,
        lighting: {
            sun: 0,
            // ambient 是时段倍率（中午档基础值 0.4）：×3.2 ≈ 绝对 1.3；
            // 低了 MToon 人物全身掉进阴影色（"蒙灰"）
            ambient: 3.2,
            fill: 0.25,   // 室内压暗蓝色补光
            spot: winless ? 0 : 1.3,
            ...(winLight ? { windowLight: winLight } : {}),
            lamp: {
                position: [0, lampY ?? h - 0.3, d / 2], color: 0xFFFFFF,
                intensity: winless ? 2.2 : 1.6, distance: Math.max(w, d) * 1.4,
                ...(winless ? { min: 0.8 } : {}),   // 无窗房顶灯常开（白天也亮）
            },
        },
    };
}
// 北窗房间的窗光（wxc = 窗洞中心 x）
const winN = (wxc, d) => ({ position: [wxc, 2.0, d + 2.0], target: [wxc, 0.4, d * 0.45] });
// spawn 简写：S 门到达（面朝 +z）/ N 门到达（面朝 -z）
const spS = (x) => ({ pos: [x, 0.02, 0.9], rotY: 0 });
const spN = (x, d) => ({ pos: [x, 0.02, d - 0.9], rotY: Math.PI });
// ── 三楼（阁楼层）4 房（2026-09-23 三楼重写，tools/make_rooms.mjs 生成）──
// 与一二楼同构 + 人字坡顶。**阁楼没有卧室**：f2 卧室1/2 的楼梯上来分别进
// 游戏室（西翼 10×12）/学习室（东翼镜像），北墙=山墙（W14/W15 三联拱窗 +
// 下楼门回 f2 平台）；中厅走廊（3×12）+ 北尽头厕所（8×10）。
// 游戏室/学习室有窗（winLight 主光源）；走廊/厕所无窗（无对应外壳窗），
// 顶灯常开补偿（winless，min 0.8 参照 f2_bath）；机位压在坡顶高区。
const ROOM_SCENES = [
    roomScene({ id: 'attic_game', name: '游戏室', nameEn: 'Game Room', glb: 'models/room_game.glb',
        w: 10, d: 12, h: 4.5, winLight: winN(-1.95, 12),   // W14 山墙 3 拱窗组中心（偏左让开下楼门）
        zonePos: [-2.2, 2.9, 0.5], zoneTarget: [1.2, 0.7, 7.5], lampY: 3.1,
        spawns: {
            // 卧室1 上行梯上来（trigger 落点）：北墙下楼门内侧，面朝南进屋
            default: { pos: [4.5, 0.02, 11.3], rotY: Math.PI },
            // 从阁楼走廊进入：-x 墙门内侧一步，面朝房间（+x）
            fromCorridor: { pos: [-4.0, 0.02, 2.2], rotY: Math.PI / 2 },
        } }),
    roomScene({ id: 'attic_study', name: '学习室', nameEn: 'Study', glb: 'models/room_study.glb',
        w: 10, d: 12, h: 4.5, winLight: winN(1.95, 12),   // W15 山墙 3 拱窗组中心（偏右）
        zonePos: [2.2, 2.9, 0.5], zoneTarget: [-1.2, 0.7, 7.5], lampY: 3.1,
        spawns: {
            default: { pos: [-4.5, 0.02, 11.3], rotY: Math.PI },
            fromCorridor: { pos: [4.0, 0.02, 2.2], rotY: -Math.PI / 2 },
        } }),
    roomScene({ id: 'attic_corridor', name: '阁楼走廊', nameEn: 'Attic Corridor', glb: 'models/room_corridor_attic.glb',
        w: 3, d: 12, h: 3.1, winless: true, lampY: 2.4,
        zonePos: [0, 2.3, 0.7], zoneTarget: [0, 1.2, 9.5],
        spawns: {
            default: { pos: [0, 0.02, 1.0], rotY: 0 },
            // 西墙门进（面朝 +x）；东墙门进（面朝 -x）；北尽头厕所门出（面朝南）
            fromGame: { pos: [-0.9, 0.02, 2.2], rotY: Math.PI / 2 },
            fromStudy: { pos: [0.9, 0.02, 2.2], rotY: -Math.PI / 2 },
            fromBath: { pos: [0, 0.02, 10.9], rotY: Math.PI },
        } }),
    roomScene({ id: 'attic_bath', name: '阁楼厕所', nameEn: 'Attic Bath', glb: 'models/room_bath_attic.glb',
        w: 8, d: 10, h: 4.0, winless: true, lampY: 2.7,
        zonePos: [-2.0, 2.7, 0.5], zoneTarget: [0.8, 0.6, 6.0],
        spawns: { default: spS(0), fromCorridor: spS(0) } }),   // 唯一门（南墙↔走廊）
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
    // ── 一楼四房（2026-09-10 改版，tools/make_f1_suite.mjs 生成）──
    // 西翼客厅 10×12 + 东翼厨房 10×12（一样大），中间 3×12 走廊联通，
    // 走廊北尽头门进客卫 8×10（比客厅略小）；客厅 +x 墙 / 厨房 -x 墙各一部
    // 悬空梯 → 二楼卧室1/卧室2
    { id: 'f1_living', name: '客厅', nameEn: 'Living Room',
      glbs: ['models/room_living.glb', 'models/furniture_living.glb'],   // 房间 + 家具（tools/make_living_furniture.py）
      zones: LIVING_ZONES, categories: LIVING_ZONE_CATEGORIES,
      spawns: {
          // 从室外大门进入：门内一步，面朝房间（+z）
          default: { pos: [0, 0.02, 0.9], rotY: 0 },
          // 从走廊进入：-x 墙门内侧一步，面朝房间（+x）
          fromCorridor: { pos: [-4.0, 0.02, 2.2], rotY: Math.PI / 2 },
          // 从卧室1下楼：+x 墙楼梯顶平台（顶部门洞触发区南侧，面朝南 -z 下楼方向）
          fromStudy: { pos: [4.5, 3.02, 11.3], rotY: Math.PI },
      },
      // 走上 +x 墙楼梯（进门面窗左手边）、将进顶部门洞时自动传送到二楼卧室1
      triggers: [
          { min: [4.0, 2.9, 11.95], max: [5.05, 3.6, 12.35], target: 'f2_bed1', spawn: 'default' },
      ],
      // 室内光照（timeOfDay.setSceneProfile）：无直射阳光，窗光为主光源，
      // 夜晚开顶灯；窗在北墙（z=12，3 拱窗组中心 x-2.05，偏 -x 让开 +x 墙楼梯）
      // 注意 ambient 是时段倍率（中午档基础值 0.4）：×3.2 ≈ 绝对 1.3，
      // 低了 MToon 人物全身掉进阴影色（"蒙灰"）
      lighting: {
          sun: 0,
          ambient: 3.2,
          fill: 0.25,
          spot: 1.3,
          windowLight: { position: [-2.05, 2.0, 14.0], target: [-2.05, 0.4, 5.5] },
          lamp: { position: [0, 4.1, 6.0], color: 0xFFFFFF, intensity: 1.6, distance: 16 },
      } },
    { id: 'f1_corridor', name: '走廊', nameEn: 'Corridor',
      glbs: ['models/room_corridor.glb'],
      zones: CORRIDOR_ZONES, categories: LIVING_ZONE_CATEGORIES,
      spawns: {
          default: { pos: [0, 0.02, 1.0], rotY: 0 },
          // 西墙门进（面朝走廊 +x）；东墙门进（面朝 -x）；北尽头客卫门出（面朝南）
          fromLiving: { pos: [-0.9, 0.02, 2.2], rotY: Math.PI / 2 },
          fromKitchen: { pos: [0.9, 0.02, 2.2], rotY: -Math.PI / 2 },
          fromBath: { pos: [0, 0.02, 10.9], rotY: Math.PI },
      },
      lighting: {
          sun: 0,
          ambient: 3.2,
          fill: 0.25,
          spot: 1.2,
          windowLight: { position: [0, 2.0, -2.0], target: [0, 0.5, 6.0] },   // 南墙 2 拱窗
          lamp: { position: [0, 2.9, 6.5], color: 0xFFFFFF, intensity: 1.4, distance: 9 },
      } },
    { id: 'f1_bath', name: '客卫', nameEn: 'Bathroom',
      glbs: ['models/room_bath_f1.glb', 'models/furniture_bath_f1.glb'],   // 房间 + changjing 卫浴家具
      zones: [{ id: 'bath_main', name: '客卫', nameEn: 'Bathroom', category: 'room',
          pos: [-3.4, 2.6, 0.5], target: [1.0, 0.6, 6.0],
          minDist: 1.0, maxDist: 11, maxPolar: Math.PI * 0.49, bounds: null }],
      categories: LIVING_ZONE_CATEGORIES,
      spawns: { default: spS(0) },
      lighting: {
          sun: 0,
          ambient: 3.2,
          fill: 0.25,
          spot: 1.3,
          windowLight: winN(0, 10),   // 北墙 3 拱窗（W3）
          lamp: { position: [0, 3.2, 5.0], color: 0xFFFFFF, intensity: 1.6, distance: 11 },
      } },
    { id: 'f1_kitchen', name: '厨房', nameEn: 'Kitchen',
      glbs: ['models/room_kitchen.glb', 'models/furniture_kitchen.glb'],   // 房间 + changjing 厨房家具
      zones: KITCHEN_ZONES, categories: LIVING_ZONE_CATEGORIES,
      spawns: {
          // 从室外东大门进入：门内一步，面朝房间（+z）
          default: { pos: [0, 0.02, 0.9], rotY: 0 },
          fromOutdoor: { pos: [0, 0.02, 0.9], rotY: 0 },
          // 从走廊进入：+x 墙门内侧一步，面朝房间（-x）
          fromCorridor: { pos: [4.0, 0.02, 2.2], rotY: -Math.PI / 2 },
          // 从卧室2下楼（-x 墙楼梯顶平台，备用落点；卧室2"下楼"门当前指这里）
          fromStudy: { pos: [-4.5, 3.02, 11.3], rotY: Math.PI },
      },
      // 厨房 -x 墙楼梯（进门面窗右手边）：走上平台、将进顶部门洞时自动传送到二楼卧室2
      triggers: [
          { min: [-5.05, 2.9, 11.95], max: [-4.0, 3.6, 12.35], target: 'f2_bed2', spawn: 'default' },
      ],
      lighting: {
          sun: 0,
          ambient: 3.2,
          fill: 0.25,
          spot: 1.3,
          windowLight: { position: [-0.45, 2.0, 14.0], target: [-0.45, 0.4, 5.5] },   // 北墙 W4 3 拱窗
          lamp: { position: [0, 4.1, 6.0], color: 0xFFFFFF, intensity: 1.6, distance: 16 },
      } },
    // ── 二楼四房（2026-09-23 重排：镜像一楼布局，tools/make_f1_suite.mjs 生成）──
    // 卧室1 = 客厅正上方（10×12×4.5）：+x 墙悬空上行梯 → 阁楼游戏室（触发区），
    // 北墙下楼门（x4.0..5.0，上行梯平台下方）→ 客厅楼梯平台，−x 墙门 → F2 走廊；
    // 卧室2 = 厨房正上方镜像（楼梯/门左右互换）
    { id: 'f2_bed1', name: '卧室1', nameEn: 'Bedroom 1',
      glbs: ['models/room_bed1.glb'],
      zones: BED1_ZONES, categories: LIVING_ZONE_CATEGORIES,
      spawns: {
          // 客厅楼梯上来（trigger 落点）：北墙下楼门内侧、梯下壁龛，面朝南进屋
          default: { pos: [4.5, 0.02, 11.3], rotY: Math.PI },
          // 从 F2 走廊进入：-x 墙门内侧一步，面朝房间（+x）
          fromCorridor: { pos: [-4.0, 0.02, 2.2], rotY: Math.PI / 2 },
          // 从阁楼游戏室 下楼：+x 墙上行梯顶平台（触发区外 z11.3 < 11.95，不回环）
          fromAtticA: { pos: [4.5, 3.02, 11.3], rotY: Math.PI },
      },
      // +x 墙上行梯顶部门洞 → 阁楼游戏室
      triggers: [
          { min: [4.0, 2.9, 11.95], max: [5.05, 3.6, 12.35], target: 'attic_game', spawn: 'default' },
      ],
      lighting: {
          sun: 0,
          ambient: 3.2,
          fill: 0.25,
          spot: 1.3,
          windowLight: { position: [-1.95, 2.0, 14.0], target: [-1.95, 0.4, 5.5] },   // 北墙 W2 3 拱窗（组偏 -x 让开井道）
          lamp: { position: [0, 4.1, 6.0], color: 0xFFFFFF, intensity: 1.6, distance: 16 },
      } },
    { id: 'f2_bed2', name: '卧室2', nameEn: 'Bedroom 2',
      glbs: ['models/room_bed2.glb'],
      zones: BED2_ZONES, categories: LIVING_ZONE_CATEGORIES,
      spawns: {
          // 厨房楼梯上来（trigger 落点）：北墙下楼门内侧、梯下壁龛，面朝南进屋
          default: { pos: [-4.5, 0.02, 11.3], rotY: Math.PI },
          // 从 F2 走廊进入：+x 墙门内侧一步，面朝房间（-x）
          fromCorridor: { pos: [4.0, 0.02, 2.2], rotY: -Math.PI / 2 },
          // 从阁楼学习室 下楼：-x 墙上行梯顶平台
          fromAtticB: { pos: [-4.5, 3.02, 11.3], rotY: Math.PI },
      },
      // -x 墙上行梯顶部门洞 → 阁楼学习室
      triggers: [
          { min: [-5.05, 2.9, 11.95], max: [-4.0, 3.6, 12.35], target: 'attic_study', spawn: 'default' },
      ],
      lighting: {
          sun: 0,
          ambient: 3.2,
          fill: 0.25,
          spot: 1.3,
          windowLight: { position: [1.95, 2.0, 14.0], target: [1.95, 0.4, 5.5] },   // 北墙 W5 3 拱窗（组偏 +x）
          lamp: { position: [0, 4.1, 6.0], color: 0xFFFFFF, intensity: 1.6, distance: 16 },
      } },
    { id: 'f2_corridor', name: '二楼走廊', nameEn: 'Corridor 2F',
      glbs: ['models/room_corridor_f2.glb'],
      zones: CORRIDOR_F2_ZONES, categories: LIVING_ZONE_CATEGORIES,
      spawns: {
          default: { pos: [0, 0.02, 1.0], rotY: 0 },
          // 西墙门进（面朝 +x）；东墙门进（面朝 -x）；北尽头厕所门出（面朝南）
          fromBed1: { pos: [-0.9, 0.02, 2.2], rotY: Math.PI / 2 },
          fromBed2: { pos: [0.9, 0.02, 2.2], rotY: -Math.PI / 2 },
          fromBath: { pos: [0, 0.02, 10.9], rotY: Math.PI },
      },
      lighting: {
          sun: 0,
          ambient: 3.2,
          fill: 0.25,
          spot: 1.2,
          windowLight: { position: [0, 2.0, -2.0], target: [0, 0.5, 6.0] },   // 南墙 2 拱窗（W7 语汇）
          lamp: { position: [0, 2.9, 6.5], color: 0xFFFFFF, intensity: 1.4, distance: 9 },
      } },
    { id: 'f2_bath', name: '二楼卫生间', nameEn: 'Bathroom 2F',
      // 房间 + changjing 卫浴家具（复用一楼 8×10 那份，见 make_changjing_furniture.py）
      glbs: ['models/room_bath_f2.glb', 'models/furniture_bath_f1.glb'],
      zones: [{ id: 'bath_f2_main', name: '二楼卫生间', nameEn: 'Bathroom 2F', category: 'room',
          pos: [-3.4, 2.6, 0.5], target: [1.0, 0.6, 6.0],
          minDist: 1.0, maxDist: 11, maxPolar: Math.PI * 0.49, bounds: null }],
      categories: LIVING_ZONE_CATEGORIES,
      spawns: {
          default: spS(0),
          fromCorridor: spS(0),   // 唯一门（南墙↔走廊）
      },
      // 无窗房（外壳 F2 北墙中段无窗）：无窗光、顶灯常开
      lighting: {
          sun: 0,
          ambient: 3.2,
          fill: 0.25,
          spot: 0,
          lamp: { position: [0, 3.2, 5.0], color: 0xFFFFFF, intensity: 2.2, distance: 11, min: 0.8 },
      } },
    ...ROOM_SCENES,
];

// 渲染器参数
export const TONE_MAPPING_EXPOSURE = 1.15;

// 后期处理 — Bloom
export const BLOOM_STRENGTH  = 0.15;
export const BLOOM_RADIUS    = 0.6;
export const BLOOM_THRESHOLD = 0.85;

// 后期处理 — 三渲二描边（OutlinePass，见 systems/toon.js）
export const OUTLINE_STRENGTH  = 3.0;
export const OUTLINE_THICKNESS = 1.5;
export const OUTLINE_COLOR     = '#4a3f35';   // 深棕，比纯黑柔和

// 点击检测（拖动 vs 点击阈值，px）
export const CLICK_DRAG_THRESHOLD = 5;

// ── 灯光系统 ──

// 环境光
export const AMBIENT_LIGHT_COLOR     = 0xf7efdf;   // 暖白（手绘风暖基调）
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
// glow/glowI = 室外窗玻璃自发光（阶段 6：清晨/傍晚/夜晚暖黄"屋里亮灯"，白天淡蓝微反光）
export const TIME_PRESETS = [
    { name: '清晨', nameEn: 'Dawn',   az: 100, el: 3,   h: 0.07, s: 0.9,  l: 0.55, sun: 0.6,  ambient: 0.15, fill: 0.1,  spot: 0.4,  bg: 0x3d2b4a, view: 0xE8A06A, lamp: 0.5, glow: 0xFFD9A0, glowI: 0.4 },
    { name: '早上', nameEn: 'Morning', az: 150, el: 20,  h: 0.11, s: 0.8,  l: 0.7,  sun: 1.2,  ambient: 0.25, fill: 0.2,  spot: 1.0,  bg: 0x7a8caa, view: 0x9FC8E8, lamp: 0, glow: 0x9FC8E8, glowI: 0.12 },
    { name: '中午', nameEn: 'Noon',    az: 180, el: 75,  h: 0.14, s: 0.3,  l: 0.95, sun: 2.0,  ambient: 0.4,  fill: 0.35, spot: 1.5,  bg: 0x87a5c0, view: 0xBFE3FF, lamp: 0, glow: 0xBFE3FF, glowI: 0.12 },
    { name: '下午', nameEn: 'Afternoon', az: 210, el: 30,  h: 0.10, s: 0.7,  l: 0.75, sun: 1.5,  ambient: 0.3,  fill: 0.25, spot: 1.2,  bg: 0x8a7060, view: 0xF0C88A, lamp: 0, glow: 0xF0C88A, glowI: 0.12 },
    { name: '傍晚', nameEn: 'Dusk',    az: 225, el: 5,   h: 0.04, s: 1.0,  l: 0.5,  sun: 0.8,  ambient: 0.15, fill: 0.1,  spot: 0.6,  bg: 0x6b4455, view: 0xFF8A50, lamp: 1.0, glow: 0xFFB85C, glowI: 0.45 },
    { name: '夜晚', nameEn: 'Night',   az: 180, el: -10, h: 0.6,  s: 0.3,  l: 0.1,  sun: 0,    ambient: 0.03, fill: 0.02, spot: 0,    bg: 0x0a0a1a, view: 0x10204A, lamp: 1.5, glow: 0xFFC46A, glowI: 0.6 },
];

// ── 四季预设（草地 + 树叶颜色；秋→冬树叶缩放落叶，见 systems/seasons.js）──
export const SEASON_PRESETS = [
    { name: '春', nameEn: 'Spring', grass: 0x7acc68, leaves: 0x7cc46a },
    { name: '夏', nameEn: 'Summer', grass: 0x4a8c3f, leaves: 0x3e7c33 },
    { name: '秋', nameEn: 'Autumn', grass: 0xb8a040, leaves: 0xd08a3a },
    { name: '冬', nameEn: 'Winter', grass: 0xe8e8e8, leaves: 0xa07838 },
];
