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
export const matWall    = new THREE.MeshStandardMaterial({ color: 0xd4b896, roughness: ROUGHNESS_MATTE });
export const matFloor   = new THREE.MeshStandardMaterial({ color: 0x8b6f4e, roughness: ROUGHNESS_SEMI_MATT });
export const matCeiling = new THREE.MeshStandardMaterial({ color: 0xe8ddd0, roughness: ROUGHNESS_SMOOTH });
export const matGlass   = new THREE.MeshStandardMaterial({ color: 0xaaddff, transparent: true, opacity: 0.1, roughness: ROUGHNESS_GLASS, metalness: 0.3 });
export const matFrame   = new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: ROUGHNESS_LOW });

// ── 家具通用 ──────────────────────────────────────────
export const matWood    = new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: ROUGHNESS_SEMI_GLOSSY });
export const matMetal   = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: ROUGHNESS_METAL, metalness: 0.8 });

// ── 织物 & 软装 ───────────────────────────────────────
export const matFabric  = new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: ROUGHNESS_SMOOTH });   // 沙发主色
export const matFabricA = new THREE.MeshStandardMaterial({ color: 0x556b2f, roughness: ROUGHNESS_SMOOTH });   // 椅子 / 靠枕
export const matCushion = new THREE.MeshStandardMaterial({ color: 0xb8860b, roughness: ROUGHNESS_SMOOTH });   // 沙发靠枕
export const matRug     = new THREE.MeshStandardMaterial({ color: 0x8b2500, roughness: 1.0 });
export const matLampSh  = new THREE.MeshStandardMaterial({ color: 0xf5deb3, roughness: ROUGHNESS_SATIN, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });

// ── 角色 ──────────────────────────────────────────────
export const matWhite   = new THREE.MeshStandardMaterial({ color: 0xf0ebe3, roughness: ROUGHNESS_MATTE });    // T恤
export const matPant    = new THREE.MeshStandardMaterial({ color: 0x2f4f4f, roughness: ROUGHNESS_MATTE });
export const matSkin    = new THREE.MeshStandardMaterial({ color: 0xdeb887, roughness: ROUGHNESS_SEMI_MATT });
export const matHair    = new THREE.MeshStandardMaterial({ color: 0x2c1810, roughness: ROUGHNESS_MATTE });
export const matShoe    = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: ROUGHNESS_SEMI_GLOSSY });
export const matEye     = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: ROUGHNESS_METAL });

// ── 书本 ──────────────────────────────────────────────
export const matBook1   = new THREE.MeshStandardMaterial({ color: 0x8b0000, roughness: ROUGHNESS_SEMI_MATT });
export const matBook2   = new THREE.MeshStandardMaterial({ color: 0x006400, roughness: ROUGHNESS_SEMI_MATT });
export const matBook3   = new THREE.MeshStandardMaterial({ color: 0x191970, roughness: ROUGHNESS_SEMI_MATT });

// ── 装饰 ──────────────────────────────────────────────
export const matPot     = new THREE.MeshStandardMaterial({ color: 0xb5651d, roughness: ROUGHNESS_SATIN });
export const matLeaf    = new THREE.MeshStandardMaterial({ color: 0x2e8b57, roughness: ROUGHNESS_MATTE });
export const matCurtain = new THREE.MeshStandardMaterial({ color: 0xd2b48c, roughness: ROUGHNESS_SMOOTH, side: THREE.DoubleSide });
