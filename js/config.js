/**
 * 场景常量配置
 * 集中管理房间尺寸、背景色等全局参数，方便统一调整
 */

// 房间尺寸
export const ROOM_WIDTH  = 8;
export const ROOM_HEIGHT = 3.5;
export const ROOM_DEPTH  = 7;
export const ROOM_HALF_W = ROOM_WIDTH / 2;   // 4
export const ROOM_HALF_D = ROOM_DEPTH / 2;    // 3.5
export const WALL_T      = 0.12;              // 墙壁厚度

// 门洞尺寸
export const DOOR_WIDTH  = 1.2;
export const DOOR_HEIGHT = 2.4;

// 背景色
export const BG_COLOR    = 0x87a5c0;   // 中午明亮天空

// 相机默认参数
export const CAMERA_FOV     = 50;
export const CAMERA_NEAR    = 0.1;
export const CAMERA_FAR     = 50;
export const CAMERA_POS     = { x: 0.5, y: 3.5, z: 6 };
export const CAMERA_TARGET  = { x: -4, y: 1.2, z: 0 };

// 轨道控制器
export const ORBIT_DAMPING       = 0.05;
export const ORBIT_MIN_DISTANCE  = 2;
export const ORBIT_MAX_DISTANCE  = 20;
export const ORBIT_MAX_POLAR     = Math.PI * 0.85; // 最大俯仰角
export const CAMERA_FOLLOW_SPEED = 3;               // 相机跟随角色的平滑速度
export const CAMERA_FOLLOW_Y     = 1.2;             // 跟随目标的 Y 偏移（角色躯干中心）
export const MAX_PIXEL_RATIO     = 2;               // 设备像素比上限

// 渲染器参数
export const TONE_MAPPING_EXPOSURE = 1.1;

// 后期处理 — Bloom
export const BLOOM_STRENGTH  = 0.15;
export const BLOOM_RADIUS    = 0.6;
export const BLOOM_THRESHOLD = 0.85;

// ── 灯光系统（暖色黄昏氛围） ────────────────────────────

// 环境光
export const AMBIENT_LIGHT_COLOR     = 0xf0f0f0; // 中性白环境光
export const AMBIENT_LIGHT_INTENSITY = 0.5;

// 主方向光（模拟夕阳从南面窗户照入）
// 后墙=南(有窗,z=-3.5), 前方=北(摄像机), 右墙=西, 左墙=东
export const SUN_COLOR      = 0xffeedd; // 暖白阳光
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

// 补光（另一侧冷色，增加层次）
export const FILL_LIGHT_COLOR     = 0x8899bb; // 冷蓝灰
export const FILL_LIGHT_INTENSITY = 0.3;
export const FILL_LIGHT_POSITION  = { x: -3, y: 4, z: -2 };

// 窗外聚光灯
export const WINDOW_SPOT_COLOR     = 0xfff0dd; // 暖白窗光
export const WINDOW_SPOT_INTENSITY = 2.0;
export const WINDOW_SPOT_DISTANCE  = 10;
export const WINDOW_SPOT_ANGLE     = Math.PI / 5; // 36°
export const WINDOW_SPOT_PENUMBRA  = 0.5;
export const WINDOW_SPOT_POSITION  = { x: 0.5, y: 2.5 }; // 窗外聚光灯位置（z 由 main.js 硬编码在南墙外侧）
export const WINDOW_SPOT_SHADOW_MAP_SIZE = 1024;

// ── 一天时间系统 ──────────────────────────────────────────
// 坐标系：后墙=南(窗,z=-3.5), 前方=北(z=+3.5), 右墙=西(x=+4), 左墙=东(x=-4)
// 方位角：0°=北, 90°=东, 180°=南, 270°=西
export const SUN_ORBIT_RADIUS = 8; // 太阳轨道半径（比房间大，确保在窗外）

export const TIME_PRESETS = [
    { name: '清晨', nameEn: 'Dawn',   az: 100, el: 3,   h: 0.07, s: 0.9,  l: 0.55, sun: 0.6,  ambient: 0.15, fill: 0.1,  spot: 0.4,  bg: 0x3d2b4a },
    { name: '早上', nameEn: 'Morning', az: 150, el: 20,  h: 0.11, s: 0.8,  l: 0.7,  sun: 1.2,  ambient: 0.25, fill: 0.2,  spot: 1.0,  bg: 0x7a8caa },
    { name: '中午', nameEn: 'Noon',    az: 180, el: 75,  h: 0.14, s: 0.3,  l: 0.95, sun: 2.0,  ambient: 0.4,  fill: 0.35, spot: 1.5,  bg: 0x87a5c0 },
    { name: '下午', nameEn: 'Afternoon', az: 210, el: 30,  h: 0.10, s: 0.7,  l: 0.75, sun: 1.5,  ambient: 0.3,  fill: 0.25, spot: 1.2,  bg: 0x8a7060 },
    { name: '傍晚', nameEn: 'Dusk',    az: 225, el: 5,   h: 0.04, s: 1.0,  l: 0.5,  sun: 0.8,  ambient: 0.15, fill: 0.1,  spot: 0.6,  bg: 0x6b4455 },
    { name: '夜晚', nameEn: 'Night',   az: 180, el: -10, h: 0.6,  s: 0.3,  l: 0.1,  sun: 0,    ambient: 0.03, fill: 0.02, spot: 0,    bg: 0x0a0a1a },
];

// ── 窗帘衰减比例（窗帘全关时保留的光线比例） ──
export const CURTAIN_SUN_FACTOR    = 0.08;  // 太阳光几乎全挡
export const CURTAIN_SPOT_FACTOR   = 0.1;   // 窗外聚光大幅减弱
export const CURTAIN_FILL_FACTOR   = 0.5;   // 补光保留一半
export const CURTAIN_AMBIENT_BOOST = 1.5;   // 环境光补偿性增加

// ── 窗帘动画 ────────────────────────────────────────────

export const CURTAIN_CLOSED_X    = 1.25;   // 关闭时：每片遮住半窗 (5.0/2/2)
export const CURTAIN_OPEN_X      = 2.95;   // 打开时：滑到杆两端
export const CURTAIN_SNAP_THRESH = 0.005;  // 移动阈值（低于此值直接吸附）
export const CURTAIN_EASE_FACTOR = 0.08;   // 每帧缓动系数（lerp 速度）
export const CURTAIN_ROD_HALF    = 3.0;    // 窗帘杆半长
export const CURTAIN_PLEAT_COMPRESSION = 0.45; // 褶皱压缩比（越小打开时越窄）
export const CURTAIN_PLEAT_FREQ_OX = 12;   // 褶皱正弦频率（ox 方向）
export const CURTAIN_PLEAT_FREQ_T  = 8;    // 褶皱正弦频率（t 方向）
export const CURTAIN_PLEAT_AMPLITUDE = 0.04; // 褶皱振幅

// ── 墙体遮挡透明 ─────────────────────────────────────────
export const OCCLUSION_TARGET_OPACITY = 0.15;  // 被遮挡墙体的目标透明度
export const OCCLUSION_LERP_SPEED     = 0.1;   // 每帧 lerp 系数（0~1，越大越快）

// ── 点击检测 ────────────────────────────────────────────

export const CLICK_DRAG_THRESHOLD = 5; // 像素阈值，超过视为拖拽

// ── 缩略图渲染 ──────────────────────────────────────────

export const THUMB_SIZE              = 96;      // 缩略图像素尺寸
export const THUMB_AMBIENT_COLOR     = 0xffffff;
export const THUMB_AMBIENT_INTENSITY = 0.6;
export const THUMB_LIGHT_COLOR       = 0xffeedd;
export const THUMB_LIGHT_INTENSITY   = 0.8;
export const THUMB_LIGHT_POSITION    = { x: 2, y: 3, z: 2 };
export const THUMB_CAMERA_FOV        = 40;
export const THUMB_CAMERA_ASPECT     = 1;
export const THUMB_CAMERA_NEAR       = 0.1;
export const THUMB_CAMERA_FAR        = 50;
export const THUMB_DIST_MULTIPLIER   = 2.2;     // 相机距离 = maxDim * 此值
export const THUMB_OFFSET_XZ         = 0.6;     // 相机偏移乘数（x, z）
export const THUMB_OFFSET_Y          = 0.4;     // 相机偏移乘数（y）
