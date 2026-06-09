/**
 * 角色步行控制：点击地面 → 角色走过去
 * 程序化走路动画（无外部 .vrma 文件）
 */
import * as THREE from 'three';
import { vrmInstance } from './humanoid.js';
import {
    ROOM_HALF_W, ROOM_HALF_D,
    CLICK_DRAG_THRESHOLD,
} from '../config.js';

// ── 移动参数 ──────────────────────────────────────────
const WALK = {
    speed: 1.2,             // 移动速度（米/秒）
    rotSpeed: 6.0,          // 转向速度（弧度/秒）
    arriveThreshold: 0.08,  // 到达判定距离
    floorY: 0.01,           // 射线检测地板的 y 值
    wallMargin: 0.3,        // 离墙最小距离
};

// ── 走路动画参数 ──────────────────────────────────────
const ANIM = {
    frequency: 4.5,         // 步频（越大越快）
    legSwing: 0.5,          // 腿部前后摆动幅度（弧度）
    kneeBend: 0.4,          // 膝盖弯曲幅度
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
let targetPos = null;       // THREE.Vector3 目标位置
let walkPhase = 0;          // 走路相位 0~2π
let walkBlend = 0;          // 动画混合权重 0=idle, 1=walk
let boneNodes = null;       // 缓存骨骼节点引用
let boneDefaults = null;    // 骨骼初始旋转备份
let humanoidGroup = null;

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
 */
export function initWalker(humanoid, camera, renderer, scene) {
    humanoidGroup = humanoid;

    // 创建点击标记
    marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.visible = false;
    scene.add(marker);

    // 收集可阻挡走路的物体（家具、角色等，不含地面）
    let blockers = [];
    scene.traverse(child => {
        if (child.isMesh && child !== marker) {
            // 排除地板（rotation.x = -PI/2 的 PlaneGeometry）
            const isFloor = child.geometry.type === 'PlaneGeometry'
                          && Math.abs(child.rotation.x + Math.PI / 2) < 0.01
                          && child.position.y === 0;
            if (!isFloor) blockers.push(child);
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
        if (Math.sqrt(dx * dx + dy * dy) > CLICK_DRAG_THRESHOLD) return;

        pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
        pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);

        // 先检测是否点到了家具/角色等物体
        const hits = raycaster.intersectObjects(blockers, true);
        if (hits.length > 0) return; // 点到物体，不触发走路

        // 再检测地面平面
        const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const hit = new THREE.Vector3();
        raycaster.ray.intersectPlane(floorPlane, hit);

        if (hit) {
            // 限制在房间内
            const mx = ROOM_HALF_W - WALK.wallMargin;
            const mz = ROOM_HALF_D - WALK.wallMargin;
            hit.x = THREE.MathUtils.clamp(hit.x, -mx, mx);
            hit.z = THREE.MathUtils.clamp(hit.z, -mz, mz);
            hit.y = 0;

            targetPos = hit;
            state = 'walking';

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

    console.log('Walker: bones initialized', Object.keys(boneNodes));
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
    if (!targetPos || !humanoidGroup) return;

    const pos = humanoidGroup.position;
    const toTarget = new THREE.Vector3().subVectors(targetPos, pos);
    toTarget.y = 0;
    const dist = toTarget.length();

    if (dist < WALK.arriveThreshold) {
        // 到达
        state = 'idle';
        targetPos = null;
        marker.visible = false;
        return;
    }

    // 转向目标
    const targetAngle = Math.atan2(toTarget.x, toTarget.z);
    let currentAngle = humanoidGroup.rotation.y;
    let diff = targetAngle - currentAngle;
    // 规范化到 [-π, π]
    diff = ((diff + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    const maxTurn = WALK.rotSpeed * delta;
    if (Math.abs(diff) > maxTurn) {
        diff = Math.sign(diff) * maxTurn;
    }
    humanoidGroup.rotation.y += diff;

    // 向前移动
    const step = Math.min(WALK.speed * delta, dist);
    const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(
        new THREE.Vector3(0, 1, 0), humanoidGroup.rotation.y
    );
    pos.addScaledVector(forward, step);
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
    const cos = Math.cos(walkPhase);

    // ── 腿部 ──
    if (boneNodes.leftUpperLeg) {
        boneNodes.leftUpperLeg.rotation.x = boneDefaults.leftUpperLeg.x + sin * ANIM.legSwing * t;
    }
    if (boneNodes.rightUpperLeg) {
        boneNodes.rightUpperLeg.rotation.x = boneDefaults.rightUpperLeg.x - sin * ANIM.legSwing * t;
    }
    if (boneNodes.leftLowerLeg) {
        // 膝盖在腿向后时弯曲
        const knee = Math.max(0, -sin) * ANIM.kneeBend * t;
        boneNodes.leftLowerLeg.rotation.x = boneDefaults.leftLowerLeg.x - knee;
    }
    if (boneNodes.rightLowerLeg) {
        const knee = Math.max(0, sin) * ANIM.kneeBend * t;
        boneNodes.rightLowerLeg.rotation.x = boneDefaults.rightLowerLeg.x - knee;
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
