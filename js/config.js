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

// 渲染器参数
export const TONE_MAPPING_EXPOSURE = 1.1;

// 后期处理 — Bloom
export const BLOOM_STRENGTH  = 0.15;
export const BLOOM_RADIUS    = 0.6;
export const BLOOM_THRESHOLD = 0.85;

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

export const TIME_PRESETS = [
    { name: '清晨', nameEn: 'Dawn',   az: 100, el: 3,   h: 0.07, s: 0.9,  l: 0.55, sun: 0.6,  ambient: 0.15, fill: 0.1,  spot: 0.4,  bg: 0x3d2b4a },
    { name: '早上', nameEn: 'Morning', az: 150, el: 20,  h: 0.11, s: 0.8,  l: 0.7,  sun: 1.2,  ambient: 0.25, fill: 0.2,  spot: 1.0,  bg: 0x7a8caa },
    { name: '中午', nameEn: 'Noon',    az: 180, el: 75,  h: 0.14, s: 0.3,  l: 0.95, sun: 2.0,  ambient: 0.4,  fill: 0.35, spot: 1.5,  bg: 0x87a5c0 },
    { name: '下午', nameEn: 'Afternoon', az: 210, el: 30,  h: 0.10, s: 0.7,  l: 0.75, sun: 1.5,  ambient: 0.3,  fill: 0.25, spot: 1.2,  bg: 0x8a7060 },
    { name: '傍晚', nameEn: 'Dusk',    az: 225, el: 5,   h: 0.04, s: 1.0,  l: 0.5,  sun: 0.8,  ambient: 0.15, fill: 0.1,  spot: 0.6,  bg: 0x6b4455 },
    { name: '夜晚', nameEn: 'Night',   az: 180, el: -10, h: 0.6,  s: 0.3,  l: 0.1,  sun: 0,    ambient: 0.03, fill: 0.02, spot: 0,    bg: 0x0a0a1a },
];

// ── 四季预设（仅草地颜色）──
export const SEASON_PRESETS = [
    { name: '春', nameEn: 'Spring', grass: 0x7acc68 },
    { name: '夏', nameEn: 'Summer', grass: 0x4a8c3f },
    { name: '秋', nameEn: 'Autumn', grass: 0xb8a040 },
    { name: '冬', nameEn: 'Winter', grass: 0xe8e8e8 },
];
