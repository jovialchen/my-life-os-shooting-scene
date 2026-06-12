/**
 * 墙体遮挡透明系统
 *
 * 从相机向角色发射射线，被命中的墙体自动变半透明，
 * 射线不再命中后恢复不透明。
 */
import * as THREE from 'three';
import { OCCLUSION_TARGET_OPACITY, OCCLUSION_LERP_SPEED } from '../config.js';

// ── 内部状态 ─────────────────────────────────────────
let apartment = null;
let camera = null;
let humanoid = null;
let houseShellGroup = null;
let gardenGroups = [];

const raycaster = new THREE.Raycaster();
const _rayOrigin = new THREE.Vector3();
const _rayTarget = new THREE.Vector3();
const _rayDir = new THREE.Vector3();

/** 当前被遮挡的墙体 group → 当前 opacity */
const occludedGroups = new Map();

/** 原始材质缓存：group → { mesh → originalMaterial } */
const originalMaterials = new WeakMap();

/** 已克隆材质的 group 集合（避免重复克隆） */
const clonedGroups = new WeakSet();

/** 可见墙体 mesh 缓存（每帧复用，避免 GC） */
const _meshCache = [];


// ── 公共接口 ─────────────────────────────────────────

/**
 * 初始化遮挡系统
 * @param {import('../apartment.js').Apartment} apt
 * @param {THREE.Camera} cam
 * @param {THREE.Group} human
 * @param {THREE.Group} shell — 外壳房子 group
 * @param {THREE.Group[]} gardens — 花园 group 数组（树木、花卉等）
 */
export function initWallOcclusion(apt, cam, human, shell, gardens = []) {
    apartment = apt;
    camera = cam;
    humanoid = human;
    houseShellGroup = shell;
    gardenGroups = gardens;
}

/**
 * 每帧更新（在 composer.render() 之前调用）
 * @param {number} delta — 帧时间（秒）
 */
export function updateWallOcclusion(delta) {
    if (!humanoid || !humanoid.userData.vrm) return;

    // 射线：相机 → 角色躯干中心
    _rayOrigin.copy(camera.position);
    _rayTarget.set(
        humanoid.position.x,
        humanoid.position.y + 1.0,
        humanoid.position.z,
    );
    _rayDir.subVectors(_rayTarget, _rayOrigin).normalize();
    raycaster.set(_rayOrigin, _rayDir);
    raycaster.far = _rayOrigin.distanceTo(_rayTarget);

    // 收集当前被射线命中的墙体 group
    const hitGroups = new Set();
    const allMeshes = collectVisibleWallMeshes();
    const intersects = raycaster.intersectObjects(allMeshes, false);

    for (const hit of intersects) {
        const mesh = hit.object;
        // 找到所属的墙体 group（isWall 的祖先）
        const wallGroup = findWallAncestor(mesh);
        if (wallGroup) {
            hitGroups.add(wallGroup);
        }
    }

    // 新增遮挡：克隆材质，开始淡化
    for (const group of hitGroups) {
        if (!occludedGroups.has(group)) {
            ensureClonedMaterials(group);
            occludedGroups.set(group, 1.0); // 从不透明开始
        }
    }

    // 更新所有被遮挡 group 的 opacity
    const toRemove = [];
    for (const [group, opacity] of occludedGroups) {
        if (hitGroups.has(group)) {
            // 继续淡化到目标
            const newOpacity = THREE.MathUtils.lerp(
                opacity, OCCLUSION_TARGET_OPACITY, OCCLUSION_LERP_SPEED,
            );
            occludedGroups.set(group, newOpacity);
            setGroupOpacity(group, newOpacity);
        } else {
            // 恢复不透明
            const newOpacity = THREE.MathUtils.lerp(opacity, 1.0, OCCLUSION_LERP_SPEED);
            if (newOpacity > 0.98) {
                // 完全恢复，重置材质
                restoreOriginalMaterials(group);
                toRemove.push(group);
            } else {
                occludedGroups.set(group, newOpacity);
                setGroupOpacity(group, newOpacity);
            }
        }
    }
    for (const group of toRemove) {
        occludedGroups.delete(group);
    }
}


// ── 内部工具 ─────────────────────────────────────────

/**
 * 收集所有可见的墙体 Mesh（遍历公寓房间 + 走廊门墙）
 * @returns {THREE.Mesh[]}
 */
function collectVisibleWallMeshes() {
    _meshCache.length = 0;

    const collect = (group) => {
        if (!group.visible) return;
        for (const child of group.children) {
            if (child.isMesh) {
                _meshCache.push(child);
            }
        }
    };

    // 各房间的墙体 + 天花板（房间 group 始终 visible，墙体始终加载）
    for (const [, room] of apartment.rooms) {
        for (const child of room.result.group.children) {
            if (child.userData?.isWall) {
                collect(child);
            } else if (child.userData?.isOccluder) {
                _meshCache.push(child);
            }
        }
    }

    // 走廊门墙（独立 group）
    for (const [, doorWall] of apartment.corridorDoorWalls) {
        if (doorWall.visible) {
            collect(doorWall);
        }
    }

    // 走廊东西墙 + 天花板
    if (apartment._corridorWestWall?.visible) collect(apartment._corridorWestWall);
    if (apartment._corridorEastWall?.visible) collect(apartment._corridorEastWall);
    if (apartment._corridorCeiling?.visible) _meshCache.push(apartment._corridorCeiling);

    // 外壳房子（isOccluder 标记的 group 或单个 mesh）
    if (houseShellGroup?.visible) {
        houseShellGroup.traverse(child => {
            if (child.userData?.isOccluder) {
                if (child.isMesh) {
                    _meshCache.push(child);
                } else {
                    collect(child);
                }
            }
        });
    }

    // 花园（树木、花卉等）
    for (const group of gardenGroups) {
        if (!group?.visible) continue;
        group.traverse(child => {
            if (child.isMesh && child.userData?.isOccluder) {
                _meshCache.push(child);
            }
        });
    }

    return _meshCache;
}

/**
 * 向上查找 isWall 或 isOccluder 标记的祖先
 * 如果 obj 本身就是标记对象（如单 Mesh 外墙），直接返回
 * @param {THREE.Object3D} obj
 * @returns {THREE.Object3D|null}
 */
function findWallAncestor(obj) {
    let current = obj;
    while (current) {
        if (current.userData?.isWall || current.userData?.isOccluder) return current;
        current = current.parent;
    }
    return null;
}

/**
 * 确保墙体 group 内的 mesh 使用独立克隆材质（仅首次）
 * @param {THREE.Group} group
 */
function ensureClonedMaterials(group) {
    if (clonedGroups.has(group)) return;
    clonedGroups.add(group);

    const originals = new Map();
    group.traverse(child => {
        if (child.isMesh && child.material) {
            originals.set(child, child.material);
            if (Array.isArray(child.material)) {
                child.material = child.material.map(m => {
                    const c = m.clone();
                    c.transparent = true;
                    c.depthWrite = true;
                    return c;
                });
            } else {
                const cloned = child.material.clone();
                cloned.transparent = true;
                cloned.depthWrite = true;
                child.material = cloned;
            }
        }
    });
    originalMaterials.set(group, originals);
}

/**
 * 恢复墙体 group 的原始材质
 * @param {THREE.Group} group
 */
function restoreOriginalMaterials(group) {
    const originals = originalMaterials.get(group);
    if (!originals) return;
    for (const [mesh, mat] of originals) {
        mesh.material = mat;
    }
    originalMaterials.delete(group);
    clonedGroups.delete(group);
}

/**
 * 设置墙体 group 内所有 mesh 的 opacity
 * @param {THREE.Group} group
 * @param {number} opacity
 */
function setGroupOpacity(group, opacity) {
    group.traverse(child => {
        if (!child.isMesh || !child.material) return;
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        for (const m of mats) {
            if (m.transparent) m.opacity = opacity;
        }
    });
}
