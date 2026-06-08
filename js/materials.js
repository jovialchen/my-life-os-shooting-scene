/**
 * 材质定义
 * 所有 MeshStandardMaterial 集中于此，修改颜色/粗糙度只需改这一处
 */
import * as THREE from 'three';

// ── 建筑 ──────────────────────────────────────────────
export const matWall    = new THREE.MeshStandardMaterial({ color: 0xd4b896, roughness: 0.9 });
export const matFloor   = new THREE.MeshStandardMaterial({ color: 0x8b6f4e, roughness: 0.8 });
export const matCeiling = new THREE.MeshStandardMaterial({ color: 0xe8ddd0, roughness: 0.95 });
export const matGlass   = new THREE.MeshStandardMaterial({ color: 0x87ceeb, transparent: true, opacity: 0.15, roughness: 0.05, metalness: 0.1 });
export const matFrame   = new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 0.6 });

// ── 家具通用 ──────────────────────────────────────────
export const matWood    = new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.7 });
export const matMetal   = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.3, metalness: 0.8 });

// ── 织物 & 软装 ───────────────────────────────────────
export const matFabric  = new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.95 });   // 沙发主色
export const matFabricA = new THREE.MeshStandardMaterial({ color: 0x556b2f, roughness: 0.95 });   // 椅子 / 靠枕
export const matCushion = new THREE.MeshStandardMaterial({ color: 0xb8860b, roughness: 0.95 });   // 沙发靠枕
export const matRug     = new THREE.MeshStandardMaterial({ color: 0x8b2500, roughness: 1.0 });
export const matLampSh  = new THREE.MeshStandardMaterial({ color: 0xf5deb3, roughness: 0.9, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });

// ── 角色 ──────────────────────────────────────────────
export const matWhite   = new THREE.MeshStandardMaterial({ color: 0xf0ebe3, roughness: 0.9 });    // T恤
export const matPant    = new THREE.MeshStandardMaterial({ color: 0x2f4f4f, roughness: 0.9 });
export const matSkin    = new THREE.MeshStandardMaterial({ color: 0xdeb887, roughness: 0.8 });
export const matHair    = new THREE.MeshStandardMaterial({ color: 0x2c1810, roughness: 0.9 });
export const matShoe    = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7 });
export const matEye     = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.3 });

// ── 书本 ──────────────────────────────────────────────
export const matBook1   = new THREE.MeshStandardMaterial({ color: 0x8b0000, roughness: 0.8 });
export const matBook2   = new THREE.MeshStandardMaterial({ color: 0x006400, roughness: 0.8 });
export const matBook3   = new THREE.MeshStandardMaterial({ color: 0x191970, roughness: 0.8 });

// ── 装饰 ──────────────────────────────────────────────
export const matPot     = new THREE.MeshStandardMaterial({ color: 0xb5651d, roughness: 0.85 });
export const matLeaf    = new THREE.MeshStandardMaterial({ color: 0x2e8b57, roughness: 0.9 });
export const matCurtain = new THREE.MeshStandardMaterial({ color: 0xd2b48c, roughness: 0.95, side: THREE.DoubleSide });
