/**
 * 角色步行控制：点击地面 → 角色走过去（自动绕开家具）
 * 程序化走路动画（无外部 .vrma 文件）
 */
import * as THREE from 'three';
// humanoid.js exports used indirectly via humanoidGroup.userData.vrm
import {
    ROOM_HALF_W, ROOM_HALF_D,
    CLICK_DRAG_THRESHOLD,
} from '../config.js';
import { buildGrid, findPath, smoothPath, isPathClear, isWalkableWorld, clampToRoomWorld } from './pathfinding.js';

// ── 移动参数 ──────────────────────────────────────────
const WALK = {
    speed: 1.2,             // 移动速度（米/秒）
    rotSpeed: 6.0,          // 转向速度（弧度/秒）
    arriveThreshold: 0.08,  // 到达路径点判定距离
    targetThreshold: 0.15,  // 到达最终目标判定距离
    floorY: 0.01,           // 射线检测地板的 y 值
    wallMargin: 0.35,       // 离墙最小距离（与 pathfinding.js WALL_MARGIN 一致）
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
let furnitureList = null;   // 家具引用（用于寻路）
let stuckCounter = 0;       // 卡住检测计数器
let prevDistance = Infinity; // 上一帧到当前路径点的距离

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
 * @param {THREE.Object3D[]} furniture - 主要家具列表（用于寻路避障）
 */
export function initWalker(humanoid, camera, renderer, scene, furniture) {
    humanoidGroup = humanoid;
    furnitureList = furniture || [];

    // 构建寻路网格
    if (furnitureList.length > 0) {
        buildGrid(furnitureList);
    }

    // 创建点击标记
    marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.visible = false;
    scene.add(marker);

    // 收集可阻挡走路的物体（家具、角色等，不含地面和角色自身）
    let blockers = [];
    const humanoids = new Set();
    // 收集角色 group 及其所有子 mesh
    humanoidGroup.traverse(child => {
        if (child.isMesh) humanoids.add(child);
    });

    scene.traverse(child => {
        if (child.isMesh && child !== marker) {
            // 排除角色自身
            if (humanoids.has(child)) return;
            // 排除地板（rotation.x = -PI/2 的 PlaneGeometry）
            const isFloor = child.geometry.type === 'PlaneGeometry'
                          && Math.abs(child.rotation.x + Math.PI / 2) < 0.01
                          && child.position.y < 0.02;
            if (!isFloor) {
                blockers.push(child);
            }
        }
    });

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

        // 先检测是否点到了家具/角色等物体
        const hits = raycaster.intersectObjects(blockers, true);
        if (hits.length > 0) {
            // 点到物体：停止走路，隐藏标记
            finishWalking();
            return;
        }

        // 再检测地面平面
        const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const hit = new THREE.Vector3();
        const intersectResult = raycaster.ray.intersectPlane(floorPlane, hit);

        if (intersectResult) {
            // 限制在房间内（与寻路网格的边界对齐）
            const clamped = clampToRoomWorld(hit.x, hit.z);
            hit.x = clamped.x;
            hit.z = clamped.z;
            hit.y = 0;

            // 点击位置不可行走，忽略
            if (!isWalkableWorld(hit.x, hit.z)) return;

            // 寻路：先算好完整路径，再让角色移动
            const path = findPath(humanoidGroup.position, hit);
            if (!path || path.length === 0) return; // 不可达

            const smoothed = smoothPath(path);

            // 尝试用实际点击位置替换最后一个路径点
            const lastIdx = smoothed.length - 1;
            const prevPt = lastIdx >= 1 ? smoothed[lastIdx - 1] : humanoidGroup.position;
            if (isPathClear(prevPt.x, prevPt.z, hit.x, hit.z)) {
                smoothed[lastIdx] = hit.clone(); // 确保使用点击位置
            } else {
                // 最后一段不畅通，保留寻路终点，但添加实际目标作为额外路径点尝试
                const lastWP = smoothed[lastIdx];
                if (isWalkableWorld(hit.x, hit.z)) {
                    // 寻路终点和点击位置之间可能只差一点点，用寻路终点即可
                    // 但我们仍然记录 targetPos 为实际点击位置
                }
            }

            waypoints = smoothed;
            targetPos = hit.clone();
            state = 'walking';
            stuckCounter = 0;
            prevDistance = Infinity;

            // 显示点击标记
            marker.position.copy(hit);
            marker.position.y = WALK.floorY;
            marker.visible = true;
        }
    });
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

    if (state === 'walking') {
        updateMovement(delta);
    }

    updateWalkAnimation(delta);
}

/**
 * 重建寻路网格（家具被拖拽后调用）
 * 如果角色正在走路，会从当前位置重新寻路到目标点
 */
export function rebuildNavGrid() {
    if (!furnitureList || furnitureList.length === 0) return;
    buildGrid(furnitureList);

    // 如果正在走路，从当前位置重新寻路
    if (state === 'walking' && targetPos && humanoidGroup) {
        const path = findPath(humanoidGroup.position, targetPos);
        if (path && path.length > 0) {
            const smoothed = smoothPath(path);
            const lastIdx = smoothed.length - 1;
            const prevPt = lastIdx >= 1 ? smoothed[lastIdx - 1] : humanoidGroup.position;
            if (isPathClear(prevPt.x, prevPt.z, targetPos.x, targetPos.z)) {
                smoothed[lastIdx] = targetPos.clone();
            }
            waypoints = smoothed;
            stuckCounter = 0;
            prevDistance = Infinity;
        } else {
            // 新位置不可达，停止走路
            finishWalking();
        }
    }
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

    // 保存 hips 初始位置
    if (boneNodes.hips) {
        boneDefaults.hipsPosition = boneNodes.hips.position.clone();
    }

    // ── 设置自然站姿（手臂放下）──
    applyIdlePose();

    // 保存站姿作为默认值
    for (const [key, node] of Object.entries(boneNodes)) {
        boneDefaults[key] = node.rotation.clone();
    }
}

/**
 * 将 T-pose 调整为自然站姿
 *
 * VRM T-pose 中上臂骨骼 local +Y 朝上(世界 Y)、手臂沿 local X 伸出。
 * 要让手臂自然下垂：
 *   左臂 → rotation.z = +π/2  (将 local -X 从世界左方转到世界下方)
 *   右臂 → rotation.z = −π/2  (将 local +X 从世界右方转到世界下方)
 */
function applyIdlePose() {
    // ── 上臂：从 T-pose 转为自然下垂 ──
    // ±π/2 是完全垂直贴身；±1.3 约向外展 ~20°，更自然
    if (boneNodes.leftUpperArm) {
        boneNodes.leftUpperArm.rotation.set(-0.1, 0, -1.3);
    }
    if (boneNodes.rightUpperArm) {
        boneNodes.rightUpperArm.rotation.set(-0.1, 0, 1.3);
    }

    // ── 前臂：肘部自然弯曲 ──
    if (boneNodes.leftLowerArm) {
        boneNodes.leftLowerArm.rotation.x = -0.35;
    }
    if (boneNodes.rightLowerArm) {
        boneNodes.rightLowerArm.rotation.x = -0.35;
    }
}

function updateMovement(delta) {
    if (!humanoidGroup) return;

    // 确定当前目标点：路径点队列的第一个
    const currentTarget = waypoints.length > 0 ? waypoints[0] : null;
    if (!currentTarget) {
        // 所有路径点已走完，检查是否已到达最终目标
        if (targetPos) {
            _toTarget.subVectors(targetPos, humanoidGroup.position);
            _toTarget.y = 0;
            const distToTarget = _toTarget.length();

            if (distToTarget < WALK.targetThreshold) {
                // 到达最终目标
                finishWalking();
                return;
            }

            // 路径走完了但还没到目标，尝试直接走过去
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

    // ── 卡住检测 ──
    if (dist > prevDistance - WALK.stuckMinDist) {
        stuckCounter++;
    } else {
        stuckCounter = 0;
    }
    prevDistance = dist;

    if (stuckCounter >= WALK.stuckFrames) {
        // 卡住了，重新寻路
        if (targetPos && furnitureList) {
            const path = findPath(pos, targetPos);
            if (path && path.length > 0) {
                const smoothed = smoothPath(path);
                const lastIdx = smoothed.length - 1;
                const prevPt = lastIdx >= 1 ? smoothed[lastIdx - 1] : pos;
                if (isPathClear(prevPt.x, prevPt.z, targetPos.x, targetPos.z)) {
                    smoothed[lastIdx] = targetPos.clone();
                }
                waypoints = smoothed;
                stuckCounter = 0;
                prevDistance = Infinity;
                return;
            }
        }
        // 重新寻路失败，停止
        finishWalking();
        return;
    }

    // ── 到达当前路径点 ──
    if (dist < WALK.arriveThreshold) {
        waypoints.shift();
        stuckCounter = 0;
        prevDistance = Infinity;

        // 没有更多路径点，进入最终目标检查
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

    // ── 沿 A* 预计算路径移动（不再做逐帧碰撞检测 + 滑行）──
    moveToward(currentTarget, delta);
}

/**
 * 向目标点移动一步（转向 + 直线前进）
 * 移动后将位置限制在房间可行走区域内
 */
function moveToward(target, delta) {
    const pos = humanoidGroup.position;
    _toTarget.subVectors(target, pos);
    _toTarget.y = 0;
    const dist = _toTarget.length();

    if (dist < 0.001) return; // 已在目标位置

    // ── 转向 ──
    const targetAngle = Math.atan2(_toTarget.x, _toTarget.z);
    let currentAngle = humanoidGroup.rotation.y;
    let diff = targetAngle - currentAngle;
    diff = ((diff + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    humanoidGroup.rotation.y += diff * Math.min(1, WALK.rotSpeed * delta);

    // ── 移动：沿目标方向直线前进 ──
    const step = Math.min(WALK.speed * delta, dist);
    const newX = pos.x + (_toTarget.x / dist) * step;
    const newZ = pos.z + (_toTarget.z / dist) * step;

    // 安全检查：目标位置是否可行走
    if (isWalkableWorld(newX, newZ)) {
        pos.x = newX;
        pos.z = newZ;
    }
    // 如果不可行走，原地等待下一帧（路径点会引导绕行）

    // ── 位置限制：确保不会离开房间 ──
    const clamped = clampToRoomWorld(pos.x, pos.z);
    pos.x = clamped.x;
    pos.z = clamped.z;
}

/**
 * 结束走路状态
 */
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

    // 混合权重过渡
    const targetBlend = state === 'walking' ? 1 : 0;
    walkBlend += (targetBlend - walkBlend) * ANIM.blendSpeed * delta;
    walkBlend = THREE.MathUtils.clamp(walkBlend, 0, 1);

    if (walkBlend < 0.01 && state === 'idle') {
        // 完全静止，恢复默认姿态
        resetPose();
        return;
    }

    // 更新走路相位
    walkPhase += delta * ANIM.frequency;
    if (walkPhase > Math.PI * 2) walkPhase -= Math.PI * 2;

    const t = walkBlend;
    const sin = Math.sin(walkPhase);

    // ── 腿部 ──
    if (boneNodes.leftUpperLeg) {
        boneNodes.leftUpperLeg.rotation.x = boneDefaults.leftUpperLeg.x + sin * ANIM.legSwing * t;
    }
    if (boneNodes.rightUpperLeg) {
        boneNodes.rightUpperLeg.rotation.x = boneDefaults.rightUpperLeg.x - sin * ANIM.legSwing * t;
    }
    if (boneNodes.leftLowerLeg) {
        // 膝盖在腿向前摆时弯曲（抬脚离地）
        const knee = Math.max(0, sin) * ANIM.kneeBend * t;
        boneNodes.leftLowerLeg.rotation.x = boneDefaults.leftLowerLeg.x + knee;
    }
    if (boneNodes.rightLowerLeg) {
        // 右腿与左腿反相
        const knee = Math.max(0, -sin) * ANIM.kneeBend * t;
        boneNodes.rightLowerLeg.rotation.x = boneDefaults.rightLowerLeg.x + knee;
    }

    // ── 手臂（与对侧腿同步）──
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

    // ── 身体上下起伏 ──
    if (boneNodes.hips) {
        const bob = Math.abs(sin) * ANIM.bodyBob * t;
        boneNodes.hips.position.y = boneDefaults.hipsPosition.y + bob;
    }

    // ── 脊椎轻微扭转 ──
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
