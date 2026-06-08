/**
 * 场景常量配置
 * 集中管理房间尺寸、背景色等全局参数，方便统一调整
 */

// 房间尺寸
export const ROOM_WIDTH  = 8;
export const ROOM_HEIGHT = 3.5;
export const ROOM_DEPTH  = 7;

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

// 渲染器参数
export const TONE_MAPPING_EXPOSURE = 0.85;

// 后期处理 — Bloom
export const BLOOM_STRENGTH  = 0.15;
export const BLOOM_RADIUS    = 0.6;
export const BLOOM_THRESHOLD = 0.85;
