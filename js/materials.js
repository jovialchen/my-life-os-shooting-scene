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
export const matWall    = new THREE.MeshStandardMaterial({ color: 0xd8d2ca, roughness: ROUGHNESS_MATTE });     // 浅灰墙面
export const matFloor   = new THREE.MeshStandardMaterial({ color: 0xc4a882, roughness: ROUGHNESS_SEMI_MATT }); // 浅原木地板
export const matCeiling = new THREE.MeshStandardMaterial({ color: 0xf2efe9, roughness: ROUGHNESS_SMOOTH });    // 纯白天花板
export const matGlass   = new THREE.MeshStandardMaterial({ color: 0xaaddff, transparent: true, opacity: 0.1, roughness: ROUGHNESS_GLASS, metalness: 0.3 });
export const matFrame   = new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: ROUGHNESS_LOW });

// ── 家具通用 ──────────────────────────────────────────
export const matWood    = new THREE.MeshStandardMaterial({ color: 0xa88c6a, roughness: ROUGHNESS_SEMI_GLOSSY }); // 浅橡木色
export const matMetal   = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: ROUGHNESS_METAL, metalness: 0.8 });

// ── 织物 & 软装 ───────────────────────────────────────
export const matFabric  = new THREE.MeshStandardMaterial({ color: 0x9a9a9a, roughness: ROUGHNESS_SMOOTH });   // 浅灰沙发
export const matFabricA = new THREE.MeshStandardMaterial({ color: 0x8faa8f, roughness: ROUGHNESS_SMOOTH });   // 灰绿椅子
export const matCushion = new THREE.MeshStandardMaterial({ color: 0xd4a0a0, roughness: ROUGHNESS_SMOOTH });   // 灰粉靠枕
export const matRug     = new THREE.MeshStandardMaterial({ color: 0xc9b8a8, roughness: 1.0 });                // 米灰色地毯
export const matLampSh  = new THREE.MeshStandardMaterial({ color: 0xf0ebe3, roughness: ROUGHNESS_SATIN, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });

// ── 角色 ──────────────────────────────────────────────
export const matWhite   = new THREE.MeshStandardMaterial({ color: 0xf0ebe3, roughness: ROUGHNESS_MATTE });    // T恤
export const matPant    = new THREE.MeshStandardMaterial({ color: 0x2f4f4f, roughness: ROUGHNESS_MATTE });
export const matSkin    = new THREE.MeshStandardMaterial({ color: 0xdeb887, roughness: ROUGHNESS_SEMI_MATT });
export const matHair    = new THREE.MeshStandardMaterial({ color: 0x2c1810, roughness: ROUGHNESS_MATTE });
export const matShoe    = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: ROUGHNESS_SEMI_GLOSSY });
export const matEye     = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: ROUGHNESS_METAL });

// ── 书本 ──────────────────────────────────────────────
export const matBook1   = new THREE.MeshStandardMaterial({ color: 0xc4a882, roughness: ROUGHNESS_SEMI_MATT }); // 米棕
export const matBook2   = new THREE.MeshStandardMaterial({ color: 0x8faa8f, roughness: ROUGHNESS_SEMI_MATT }); // 灰绿
export const matBook3   = new THREE.MeshStandardMaterial({ color: 0xb0a0b0, roughness: ROUGHNESS_SEMI_MATT }); // 灰紫

// ── 装饰 ──────────────────────────────────────────────
export const matPot     = new THREE.MeshStandardMaterial({ color: 0xc4b8a8, roughness: ROUGHNESS_SATIN }); // 浅灰陶盆
export const matLeaf    = new THREE.MeshStandardMaterial({ color: 0x2e8b57, roughness: ROUGHNESS_MATTE });
export const matCurtain = new THREE.MeshStandardMaterial({ color: 0xe0d8cc, roughness: ROUGHNESS_SMOOTH, side: THREE.DoubleSide }); // 米白窗帘

// ── 外壳房子 ─────────────────────────────────────────
export const matSiding  = new THREE.MeshStandardMaterial({ color: 0xf2efe9, roughness: ROUGHNESS_MATTE });        // 纯白外墙
export const matTrim    = new THREE.MeshStandardMaterial({ color: 0xe0dbd2, roughness: ROUGHNESS_SEMI_MATT });     // 浅灰装饰线条
export const matRoof    = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: ROUGHNESS_SATIN });         // 深灰屋顶
export const matGround  = new THREE.MeshStandardMaterial({ color: 0x8b6f4e, roughness: ROUGHNESS_SEMI_MATT });        // 地面（与地板同色）
