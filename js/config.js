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

// 背景与雾效
export const BG_COLOR    = 0x6b4455;   // 暖紫黄昏天空
export const FOG_NEAR    = 8;
export const FOG_FAR     = 25;

// 相机默认参数
export const CAMERA_FOV     = 50;
export const CAMERA_NEAR    = 0.1;
export const CAMERA_FAR     = 50;
export const CAMERA_POS     = { x: 4.5, y: 3.5, z: 6 };
export const CAMERA_TARGET  = { x: 0, y: 1.2, z: 0 };

// 轨道控制器
export const ORBIT_DAMPING       = 0.05;
export const ORBIT_MIN_DISTANCE  = 2;
export const ORBIT_MAX_DISTANCE  = 12;
export const ORBIT_MAX_POLAR     = Math.PI * 0.85; // 最大俯仰角
export const MAX_PIXEL_RATIO     = 2;               // 设备像素比上限

// 渲染器参数
export const TONE_MAPPING_EXPOSURE = 0.85;

// 后期处理 — Bloom
export const BLOOM_STRENGTH  = 0.15;
export const BLOOM_RADIUS    = 0.6;
export const BLOOM_THRESHOLD = 0.85;

// ── 灯光系统（暖色黄昏氛围） ────────────────────────────

// 环境光
export const AMBIENT_LIGHT_COLOR     = 0xffeedd; // 柔和暖色基底
export const AMBIENT_LIGHT_INTENSITY = 0.3;

// 主方向光（模拟夕阳从窗户照入）
export const SUN_COLOR      = 0xffaa55; // 橙色夕阳
export const SUN_INTENSITY  = 1.8;
export const SUN_POSITION   = { x: 5, y: 6, z: 2 };
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
export const WINDOW_SPOT_COLOR     = 0xffcc88; // 暖琥珀色
export const WINDOW_SPOT_INTENSITY = 2.0;
export const WINDOW_SPOT_DISTANCE  = 10;
export const WINDOW_SPOT_ANGLE     = Math.PI / 5; // 36°
export const WINDOW_SPOT_PENUMBRA  = 0.5;
export const WINDOW_SPOT_POSITION  = { x: 0.5, y: 2.5, z: -0.5 }; // 相对 ROOM_WIDTH/2 的偏移
export const WINDOW_SPOT_SHADOW_MAP_SIZE = 1024;

// ── 窗帘开合联动灯光（窗帘关闭时自然光减弱，台灯补光） ──
export const CURTAIN_CLOSED_SUN_INTENSITY       = 0.15;  // 关帘后夕阳光几乎消失
export const CURTAIN_CLOSED_WINDOW_SPOT_INTENSITY = 0.2;   // 关帘后窗外聚光大幅减弱
export const CURTAIN_CLOSED_FILL_LIGHT_INTENSITY = 0.15;  // 关帘后补光也减弱
export const CURTAIN_CLOSED_AMBIENT_INTENSITY    = 0.45;  // 关帘后环境光稍增（补偿整体亮度）

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
