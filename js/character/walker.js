/**
 * 角色步行控制：点击地面 → 角色走过去（自动绕开家具）
 * 程序化走路动画（无外部 .vrma 文件）
 *
 * 使用统一寻路网格，支持跨房间行走：点击任意可见地面，角色直接走过去
 */
import * as THREE from 'three';
import { CLICK_DRAG_THRESHOLD } from '../config.js';
import { rebuildGrid, findPath, smoothPath, isPathClear, isWalkableWorld } from './pathfinding.js';

// ── 移动参数 ──────────────────────────────────────────
const WALK = {
    speed: 1.2,             // 移动速度（米/秒）
    rotSpeed: 6.0,          // 转向速度（弧度/秒）
    arriveThreshold: 0.08,  // 到达路径点判定距离
    targetThreshold: 0.15,  // 到达最终目标判定距离
    floorY: 0.01,           // 射线检测地板的 y 值
    stuckFrames: 30,        // 连续多少帧没有明显前进则视为卡住
    stuckMinDist: 0.01,     // 卡住判定的最小移动距离
};

// ── 走路动画参数 ──────────────────────────────────────
const ANIM = {
    frequency: 4.5,         // 步频（越大越快）
    legSwing: 0.5,          // 腿部前后摆动幅度（弧度）
    kneeBend: 1.1,          // 膝盖弯曲幅度
    armSwing: 0.35,         // 手臂摆动幅度
    armBend: 0.2,           // 手臂弯曲
    bodyBob: 0.02,          // 身体上下起伏（米）
    spineTwist: 0.04,       // 脊椎左右扭转
    blendSpeed: 8.0,        // 动画混合速度（idle ↔ walk 过渡）
};

// ── 骨骼名称 ──────────────────────────────────────────
const BONE_NAMES = {
    hips: 'hips',
    spine: 'spine',
    leftUpperLeg: 'leftUpperLeg',
    leftLowerLeg: 'leftLowerLeg',
    rightUpperLeg: 'rightUpperLeg',
    rightLowerLeg: 'rightLowerLeg',
    leftUpperArm: 'leftUpperArm',
    leftLowerArm: 'leftLowerArm',
    rightUpperArm: 'rightUpperArm',
    rightLowerArm: 'rightLowerArm',
};

// ── 状态 ──────────────────────────────────────────────
let state = 'idle';         // 'idle' | 'walking'
let targetPos = null;       // THREE.Vector3 最终目标位置
let waypoints = [];         // THREE.Vector3[] 路径点队列
let walkPhase = 0;          // 走路相位 0~2π
let walkBlend = 0;          // 动画混合权重 0=idle, 1=walk
let boneNodes = null;       // 缓存骨骼节点引用
let boneDefaults = null;    // 骨骼初始旋转备份
let humanoidGroup = null;
let stuckCounter = 0;       // 卡住检测计数器
let prevDistance = Infinity; // 上一帧到当前路径点的距离

/** @type {import('../apartment.js').Apartment|null} */
let apartment = null;

// 预分配向量（避免每帧分配）
const _toTarget = new THREE.Vector3();

// ── 点击标记 ──────────────────────────────────────────
let marker = null;
const markerGeometry = new THREE.RingGeometry(0.15, 0.2, 32);
markerGeometry.rotateX(-Math.PI / 2);
const markerMaterial = new THREE.MeshBasicMaterial({
    color: 0xffcc66,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
});

// ── 射线检测 ──────────────────────────────────────────
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let pointerDownPos = null;

/**
 * 初始化步行系统
 * @param {THREE.Group} humanoid - 角色 group
 * @param {THREE.Camera} camera
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Scene} scene
 * @param {import('../apartment.js').Apartment|null} apt - 公寓管理器
 */
export function initWalker(humanoid, camera, renderer, scene, apt) {
    humanoidGroup = humanoid;
    apartment = apt;

    // 创建点击标记
    marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.visible = false;
    scene.add(marker);

    // 监听点击
    renderer.domElement.addEventListener('pointerdown', e => {
        pointerDownPos = { x: e.clientX, y: e.clientY };
    });

    renderer.domElement.addEventListener('pointerup', e => {
        if (!pointerDownPos) return;
        const dx = e.clientX - pointerDownPos.x;
        const dy = e.clientY - pointerDownPos.y;
        pointerDownPos = null;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > CLICK_DRAG_THRESHOLD) return;

        pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
        pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);

        // 检测地面平面
        const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const hit = new THREE.Vector3();
        const intersectResult = raycaster.ray.intersectPlane(floorPlane, hit);

        if (intersectResult) {
            hit.y = 0;
            const walkable = isWalkableWorld(hit.x, hit.z);
            const path = walkable ? findPath(humanoidGroup.position, hit) : null;
            console.log(`[Click] hit(${hit.x.toFixed(2)},${hit.z.toFixed(2)}) walk=${walkable} path=${path ? path.length : 'null'} char(${humanoidGroup.position.x.toFixed(2)},${humanoidGroup.position.z.toFixed(2)})`);
            if (!path && walkable) {
                // 门口区域诊断：打印 z=3.0 到 4.5 每 0.1m 的状态
                console.log('  doorway scan x=0:');
                for (let z = 3.0; z <= 4.5; z += 0.1) {
                    const w = isWalkableWorld(0, z);
                    if (!w) console.log(`    z=${z.toFixed(1)} BLOCKED`);
                }
            }
            if (!walkable) return;
            if (!path || path.length === 0) return;

            const smoothed = smoothPath(path);

            // 尝试用实际点击位置替换最后一个路径点
            const lastIdx = smoothed.length - 1;
            const prevPt = lastIdx >= 1 ? smoothed[lastIdx - 1] : humanoidGroup.position;
            if (isPathClear(prevPt.x, prevPt.z, hit.x, hit.z)) {
                smoothed[lastIdx] = hit.clone();
            }

            waypoints = smoothed;
            targetPos = hit.clone();
            state = 'walking';
            stuckCounter = 0;
            prevDistance = Infinity;

            marker.position.copy(hit);
            marker.position.y = WALK.floorY;
            marker.visible = true;
        }
    });
}

/**
 * 重建寻路网格（门开合、家具拖拽后调用）
 */
export function rebuildNavGrid() {
    if (!apartment) return;
    rebuildGrid(apartment.rooms);
}

/**
 * 每帧更新（在 animate 中调用）
 * @param {number} delta - 帧间隔秒数
 */
export function updateWalker(delta) {
    if (!humanoidGroup) return;

    // 延迟初始化骨骼（VRM 异步加载）
    if (!boneNodes && humanoidGroup.userData.vrm) {
        initBones();
    }

    // 更新当前房间（基于角色位置）
    if (apartment) {
        apartment.updateCurrentRoomByPos(humanoidGroup.position);
    }

    if (state === 'walking') {
        updateMovement(delta);
    }

    updateWalkAnimation(delta);
}

// ── 内部函数 ──────────────────────────────────────────

function initBones() {
    const vrm = humanoidGroup.userData.vrm;
    if (!vrm?.humanoid) return;

    boneNodes = {};
    boneDefaults = {};

    for (const [key, name] of Object.entries(BONE_NAMES)) {
        const node = vrm.humanoid.getNormalizedBoneNode(name);
        if (node) {
            boneNodes[key] = node;
        }
    }

    if (boneNodes.hips) {
        boneDefaults.hipsPosition = boneNodes.hips.position.clone();
    }

    applyIdlePose();

    for (const [key, node] of Object.entries(boneNodes)) {
        boneDefaults[key] = node.rotation.clone();
    }
}

function applyIdlePose() {
    if (boneNodes.leftUpperArm) {
        boneNodes.leftUpperArm.rotation.set(-0.1, 0, -1.3);
    }
    if (boneNodes.rightUpperArm) {
        boneNodes.rightUpperArm.rotation.set(-0.1, 0, 1.3);
    }
    if (boneNodes.leftLowerArm) {
        boneNodes.leftLowerArm.rotation.x = -0.35;
    }
    if (boneNodes.rightLowerArm) {
        boneNodes.rightLowerArm.rotation.x = -0.35;
    }
}

function updateMovement(delta) {
    if (!humanoidGroup) return;

    const currentTarget = waypoints.length > 0 ? waypoints[0] : null;
    if (!currentTarget) {
        if (targetPos) {
            _toTarget.subVectors(targetPos, humanoidGroup.position);
            _toTarget.y = 0;
            const distToTarget = _toTarget.length();

            if (distToTarget < WALK.targetThreshold) {
                finishWalking();
                return;
            }

            if (isWalkableWorld(targetPos.x, targetPos.z)) {
                moveToward(targetPos, delta);
                return;
            }
        }
        finishWalking();
        return;
    }

    const pos = humanoidGroup.position;
    _toTarget.subVectors(currentTarget, pos);
    _toTarget.y = 0;
    const dist = _toTarget.length();

    // 卡住检测
    if (dist > prevDistance - WALK.stuckMinDist) {
        stuckCounter++;
    } else {
        stuckCounter = 0;
    }
    prevDistance = dist;

    if (stuckCounter >= WALK.stuckFrames) {
        if (targetPos) {
            const path = findPath(pos, targetPos);
            if (path && path.length > 0) {
                const smoothed = smoothPath(path);
                waypoints = smoothed;
                stuckCounter = 0;
                prevDistance = Infinity;
                return;
            }
        }
        finishWalking();
        return;
    }

    // 到达当前路径点
    if (dist < WALK.arriveThreshold) {
        waypoints.shift();
        stuckCounter = 0;
        prevDistance = Infinity;

        if (waypoints.length === 0) {
            if (targetPos) {
                _toTarget.subVectors(targetPos, pos);
                _toTarget.y = 0;
                if (_toTarget.length() < WALK.targetThreshold) {
                    finishWalking();
                    return;
                }
            } else {
                finishWalking();
                return;
            }
        }
        return;
    }

    moveToward(currentTarget, delta);
}

/**
 * 向目标点移动一步（转向 + 直线前进）
 */
function moveToward(target, delta) {
    const pos = humanoidGroup.position;
    _toTarget.subVectors(target, pos);
    _toTarget.y = 0;
    const dist = _toTarget.length();

    if (dist < 0.001) return;

    // 转向
    const targetAngle = Math.atan2(_toTarget.x, _toTarget.z);
    let currentAngle = humanoidGroup.rotation.y;
    let diff = targetAngle - currentAngle;
    diff = ((diff + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    humanoidGroup.rotation.y += diff * Math.min(1, WALK.rotSpeed * delta);

    // 移动
    const step = Math.min(WALK.speed * delta, dist);
    const newX = pos.x + (_toTarget.x / dist) * step;
    const newZ = pos.z + (_toTarget.z / dist) * step;

    if (isWalkableWorld(newX, newZ)) {
        pos.x = newX;
        pos.z = newZ;
    }
}

function finishWalking() {
    state = 'idle';
    targetPos = null;
    waypoints = [];
    stuckCounter = 0;
    prevDistance = Infinity;
    marker.visible = false;
}

function updateWalkAnimation(delta) {
    if (!boneNodes) return;

    const targetBlend = state === 'walking' ? 1 : 0;
    walkBlend += (targetBlend - walkBlend) * ANIM.blendSpeed * delta;
    walkBlend = THREE.MathUtils.clamp(walkBlend, 0, 1);

    if (walkBlend < 0.01 && state === 'idle') {
        resetPose();
        return;
    }

    walkPhase += delta * ANIM.frequency;
    if (walkPhase > Math.PI * 2) walkPhase -= Math.PI * 2;

    const t = walkBlend;
    const sin = Math.sin(walkPhase);

    if (boneNodes.leftUpperLeg) {
        boneNodes.leftUpperLeg.rotation.x = boneDefaults.leftUpperLeg.x + sin * ANIM.legSwing * t;
    }
    if (boneNodes.rightUpperLeg) {
        boneNodes.rightUpperLeg.rotation.x = boneDefaults.rightUpperLeg.x - sin * ANIM.legSwing * t;
    }
    if (boneNodes.leftLowerLeg) {
        const knee = Math.max(0, sin) * ANIM.kneeBend * t;
        boneNodes.leftLowerLeg.rotation.x = boneDefaults.leftLowerLeg.x + knee;
    }
    if (boneNodes.rightLowerLeg) {
        const knee = Math.max(0, -sin) * ANIM.kneeBend * t;
        boneNodes.rightLowerLeg.rotation.x = boneDefaults.rightLowerLeg.x + knee;
    }
    if (boneNodes.leftUpperArm) {
        boneNodes.leftUpperArm.rotation.x = boneDefaults.leftUpperArm.x - sin * ANIM.armSwing * t;
    }
    if (boneNodes.rightUpperArm) {
        boneNodes.rightUpperArm.rotation.x = boneDefaults.rightUpperArm.x + sin * ANIM.armSwing * t;
    }
    if (boneNodes.leftLowerArm) {
        boneNodes.leftLowerArm.rotation.x = boneDefaults.leftLowerArm.x - ANIM.armBend * t;
    }
    if (boneNodes.rightLowerArm) {
        boneNodes.rightLowerArm.rotation.x = boneDefaults.rightLowerArm.x - ANIM.armBend * t;
    }
    if (boneNodes.hips) {
        const bob = Math.abs(sin) * ANIM.bodyBob * t;
        boneNodes.hips.position.y = boneDefaults.hipsPosition.y + bob;
    }
    if (boneNodes.spine) {
        boneNodes.spine.rotation.y = boneDefaults.spine.y + sin * ANIM.spineTwist * t;
    }
}

function resetPose() {
    if (!boneNodes || !boneDefaults) return;

    for (const [key, node] of Object.entries(boneNodes)) {
        if (key === 'hips') continue;
        const def = boneDefaults[key];
        if (def) {
            node.rotation.x = def.x;
            node.rotation.y = def.y;
            node.rotation.z = def.z;
        }
    }
    if (boneNodes.hips && boneDefaults.hipsPosition) {
        boneNodes.hips.position.copy(boneDefaults.hipsPosition);
    }
}
