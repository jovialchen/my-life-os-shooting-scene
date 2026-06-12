/**
 * 材质定义
 * 所有 MeshStandardMaterial 集中于此，修改颜色/粗糙度只需改这一处
 */
import * as THREE from 'three';

// ── 共享粗糙度等级 ─────────────────────────────────────
const ROUGHNESS_MATTE     = 0.9;   // 哑光（墙面、织物、头发等）
const ROUGHNESS_SMOOTH    = 0.95;  // 丝滑（天花板、靠枕、窗帘等）
const ROUGHNESS_SEMI_MATT = 0.8;   // 半哑光（木地板、皮肤、书本等）
const ROUGHNESS_SATIN     = 0.85;  // 缎面（花盆、灯罩等）
const ROUGHNESS_SEMI_GLOSSY = 0.7; // 半光（木家具、鞋面）
const ROUGHNESS_LOW       = 0.6;   // 低粗糙度（画框）
const ROUGHNESS_METAL     = 0.3;   // 金属（灯具、金属件、眼睛）
const ROUGHNESS_GLASS     = 0.02;  // 玻璃

// ── 建筑 ──────────────────────────────────────────────
export const matWall    = new THREE.MeshStandardMaterial({ color: 0xf4f8fa, roughness: ROUGHNESS_MATTE });     // 冷白墙面
export const matFloor   = new THREE.MeshStandardMaterial({ color: 0xd4c8b0, roughness: ROUGHNESS_SEMI_MATT }); // 浅白蜡木地板
export const matCeiling = new THREE.MeshStandardMaterial({ color: 0xf5f8fa, roughness: ROUGHNESS_SMOOTH });    // 冷白天花板
export const matGlass   = new THREE.MeshStandardMaterial({ color: 0xaaddff, transparent: true, opacity: 0.1, roughness: ROUGHNESS_GLASS, metalness: 0.3, side: THREE.DoubleSide });
export const matFrame   = new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: ROUGHNESS_LOW, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });

// ── 家具通用 ──────────────────────────────────────────
export const matWood    = new THREE.MeshStandardMaterial({ color: 0xdeb887, roughness: ROUGHNESS_SEMI_GLOSSY }); // 宜家白桦木
export const matMetal   = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: ROUGHNESS_METAL, metalness: 0.8 });

// ── 织物 & 软装 ───────────────────────────────────────
export const matFabric  = new THREE.MeshStandardMaterial({ color: 0x0097a7, roughness: ROUGHNESS_SMOOTH });   // 宜家青色沙发（KIVIK）
export const matFabricA = new THREE.MeshStandardMaterial({ color: 0xffda00, roughness: ROUGHNESS_SMOOTH });   // 宜家明黄椅子（POÄNG）
export const matCushion = new THREE.MeshStandardMaterial({ color: 0xf06060, roughness: ROUGHNESS_SMOOTH });   // 宜家珊瑚红靠枕
export const matRug     = new THREE.MeshStandardMaterial({ color: 0xf5f5f0, roughness: 1.0 });                // 宜家纯白地毯
export const matLampSh  = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: ROUGHNESS_SATIN, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });

// ── 角色 ──────────────────────────────────────────────
export const matWhite   = new THREE.MeshStandardMaterial({ color: 0xf0ebe3, roughness: ROUGHNESS_MATTE });    // T恤
export const matPant    = new THREE.MeshStandardMaterial({ color: 0x2f4f4f, roughness: ROUGHNESS_MATTE });
export const matSkin    = new THREE.MeshStandardMaterial({ color: 0xdeb887, roughness: ROUGHNESS_SEMI_MATT });
export const matHair    = new THREE.MeshStandardMaterial({ color: 0x2c1810, roughness: ROUGHNESS_MATTE });
export const matShoe    = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: ROUGHNESS_SEMI_GLOSSY });
export const matEye     = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: ROUGHNESS_METAL });

// ── 书本 ──────────────────────────────────────────────
export const matBook1   = new THREE.MeshStandardMaterial({ color: 0x0058a3, roughness: ROUGHNESS_SEMI_MATT }); // 宜家蓝
export const matBook2   = new THREE.MeshStandardMaterial({ color: 0xffda00, roughness: ROUGHNESS_SEMI_MATT }); // 宜家黄
export const matBook3   = new THREE.MeshStandardMaterial({ color: 0xe74c3c, roughness: ROUGHNESS_SEMI_MATT }); // 宜家红

// ── 装饰 ──────────────────────────────────────────────
export const matPot     = new THREE.MeshStandardMaterial({ color: 0xf5f5f0, roughness: ROUGHNESS_SATIN }); // 宜家白陶盆
export const matLeaf    = new THREE.MeshStandardMaterial({ color: 0x2e8b57, roughness: ROUGHNESS_MATTE });
export const matCurtain = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: ROUGHNESS_SMOOTH, side: THREE.DoubleSide }); // 宜家纯白窗帘

// ── 花卉 ──────────────────────────────────────────────
export const matStem         = new THREE.MeshStandardMaterial({ color: 0x3a6b35, roughness: ROUGHNESS_MATTE }); // 深绿茎
export const matPetalPink    = new THREE.MeshStandardMaterial({ color: 0xe8a0a0, roughness: ROUGHNESS_SATIN }); // 粉（月季）
export const matPetalDeepPink = new THREE.MeshStandardMaterial({ color: 0xc97070, roughness: ROUGHNESS_SATIN }); // 深粉（玫瑰）
export const matPetalPurple  = new THREE.MeshStandardMaterial({ color: 0x9070b0, roughness: ROUGHNESS_SATIN }); // 紫（紫罗兰）
export const matPetalBlue    = new THREE.MeshStandardMaterial({ color: 0x7080c0, roughness: ROUGHNESS_SATIN }); // 蓝紫（鸢尾花）
export const matPetalWhite   = new THREE.MeshStandardMaterial({ color: 0xf0ebe3, roughness: ROUGHNESS_SATIN }); // 白（茉莉）
export const matFlowerCenter = new THREE.MeshStandardMaterial({ color: 0xf5d742, roughness: ROUGHNESS_MATTE }); // 黄花蕊
export const matPetalYellow   = new THREE.MeshStandardMaterial({ color: 0xf0d020, roughness: ROUGHNESS_SATIN }); // 黄（向日葵/郁金香）
export const matPetalLavender = new THREE.MeshStandardMaterial({ color: 0x8060a0, roughness: ROUGHNESS_SATIN }); // 紫（薰衣草）
export const matPetalRed      = new THREE.MeshStandardMaterial({ color: 0xd03030, roughness: ROUGHNESS_SATIN }); // 红（郁金香）
export const matSunflowerCenter = new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: ROUGHNESS_MATTE }); // 棕（向日葵花心）

// ── 树木 ──────────────────────────────────────────────
export const matTrunk      = new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: ROUGHNESS_SEMI_MATT }); // 深棕树干
export const matCanopy     = new THREE.MeshStandardMaterial({ color: 0x4a8c3f, roughness: ROUGHNESS_MATTE });     // 鲜绿阔叶树冠
export const matCanopyDark = new THREE.MeshStandardMaterial({ color: 0x2d6b2e, roughness: ROUGHNESS_MATTE });     // 深绿松树冠
export const matBlossom    = new THREE.MeshStandardMaterial({ color: 0xf0a0b0, roughness: ROUGHNESS_SATIN });     // 粉红樱花

// ── 外壳房子 ─────────────────────────────────────────
export const matSiding  = new THREE.MeshStandardMaterial({ color: 0xf2efe9, roughness: ROUGHNESS_MATTE });        // 纯白外墙
export const matTrim    = new THREE.MeshStandardMaterial({ color: 0xd8e0e4, roughness: ROUGHNESS_SEMI_MATT });     // 冷灰装饰线条
export const matRoof    = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: ROUGHNESS_SATIN });         // 深灰屋顶
export const matGround  = new THREE.MeshStandardMaterial({ color: 0x8b6f4e, roughness: ROUGHNESS_SEMI_MATT });        // 地面（与地板同色）
