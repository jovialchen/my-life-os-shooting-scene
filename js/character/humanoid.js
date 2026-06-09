/**
 * 角色：VRM 动漫角色加载器
 * 加载 hazel-pink.vrm 模型，驱动 spring bone / 表情 / 目光
 * 如果 MToon 着色器编译失败，自动回退到标准材质
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin } from '@pixiv/three-vrm';

// ── 角色摆放参数 ──────────────────────────────────────
const VRM = {
    posX: 1.5,          // x 位置
    posY: 0,            // y 位置
    posZ: 0.3,          // z 位置
    rotY: -0.4,         // y 旋转（弧度）
    fallbackColor: 0xffffff, // 回退材质颜色
};

// ── 眨眼参数 ──────────────────────────────────────────
const BLINK = {
    minInterval: 2.0,   // 最短间隔（秒）
    maxInterval: 6.0,   // 最长间隔（秒）
    closeSpeed: 0.12,   // 闭眼速度（秒）
    openSpeed: 0.15,    // 睁眼速度（秒）
};

// ── 表情呼吸参数 ──────────────────────────────────────
const BREATH = {
    speed: 0.8,         // 呼吸频率
    amount: 0.15,       // 呼吸幅度（0~1）
};

// ── 内部状态 ──────────────────────────────────────────
export let vrmInstance = null;
let blinkTimer = 0;          // 距下次眨眼的倒计时
let blinkPhase = 'idle';     // 'idle' | 'closing' | 'opening'
let blinkValue = 0;          // 当前眨眼值 0~1
let breathTime = 0;

/**
 * 创建角色 group（异步加载 VRM，立即返回空 group）
 */
export function createHumanoid() {
    const group = new THREE.Group();

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    loader.load(
        './models/hazel-pink.vrm',
        (gltf) => {
            const vrm = gltf.userData.vrm;
            if (!vrm) {
                console.error('VRM: gltf.userData.vrm is undefined');
                return;
            }

            // 开启阴影 + MToon 着色器失败时回退到标准材质
            gltf.scene.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;

                    // 检测 ShaderMaterial（MToon），替换为 MeshStandardMaterial
                    if (child.material && child.material.type === 'ShaderMaterial') {
                        const m = child.material;
                        const color = m.color || new THREE.Color(VRM.fallbackColor);
                        const map = m.map || null;
                        const fallback = new THREE.MeshStandardMaterial({
                            color,
                            map,
                            side: m.side ?? THREE.FrontSide,
                            transparent: m.transparent ?? false,
                            opacity: m.opacity ?? 1.0,
                            alphaTest: m.alphaTest ?? 0,
                        });
                        child.material = fallback;
                        console.log('MToon → Standard fallback:', child.name);
                    }
                }
            });

            // 调整位置和朝向（设在 group 上，vrm.scene 保持原点）
            group.position.set(VRM.posX, VRM.posY, VRM.posZ);
            group.rotation.y = VRM.rotY;

            group.add(vrm.scene);

            // 保存 vrm 引用，供动画系统使用
            group.userData.vrm = vrm;
            vrmInstance = vrm;

            // 初始化眨眼计时器
            resetBlinkTimer();

            console.log('VRM loaded:', vrm.meta?.name);
        },
        (progress) => {
            const pct = progress.total ? Math.round((progress.loaded / progress.total) * 100) : '?';
            console.log(`VRM loading: ${pct}%`);
        },
        (error) => {
            console.error('VRM load error:', error);
        }
    );

    return group;
}

/**
 * 设置 LookAt 目标（例如传入 camera）
 */
export function setHumanoidLookAt(target) {
    if (!vrmInstance) return;
    const la = vrmInstance.lookAt;
    if (!la) {
        console.warn('VRM: lookAt not available on this model');
        return;
    }
    la.target = target;

    // VRM 文件未指定 lookAt type 时，需要手动设置为 'bone'
    // 否则 applier 不会被创建，目光不会跟踪目标
    if (la.type === undefined) {
        la.type = 'bone';
        console.log('VRM LookAt type auto-set to: bone');
    }
    console.log('VRM LookAt target set, type:', la.type);
}

/**
 * 每帧更新：spring bone 物理 + 眨眼 + 表情呼吸 + lookAt
 * 在主循环中调用
 */
// 调试计数器（只打印一次）
let lookAtDebugDone = false;

export function updateHumanoid(delta) {
    if (!vrmInstance) return;

    // ── Spring bone 物理（头发/衣服摆动）──
    vrmInstance.update(delta);

    // ── LookAt 调试（只打印一次）──
    if (!lookAtDebugDone && vrmInstance.lookAt) {
        const la = vrmInstance.lookAt;
        const headBone = vrmInstance.humanoid?.getNormalizedBoneNode('head');
        const leftEye = vrmInstance.humanoid?.getNormalizedBoneNode('leftEye');
        const rightEye = vrmInstance.humanoid?.getNormalizedBoneNode('rightEye');
        console.log('LookAt debug:', {
            type: la.type,
            target: la.target?.isCamera ? 'Camera' : (la.target?.constructor?.name ?? 'none'),
            hasHeadBone: !!headBone,
            hasEyeBones: !!(leftEye && rightEye),
        });
        lookAtDebugDone = true;
    }

    // ── 头部朝向相机（手动追踪，作为 LookAt 的补充/后备）──
    updateHeadTracking(delta);

    // ── 自动眨眼 ──
    updateBlink(delta);

    // ── 表情呼吸 ──
    updateBreath(delta);
}

// ── 头部追踪 ──────────────────────────────────────────

const HEAD_TRACK = {
    maxYaw: 0.6,        // 水平最大转动角度（弧度）
    maxPitch: 0.3,      // 垂直最大转动角度
    smoothSpeed: 3.0,   // 平滑跟踪速度
};

// 预分配临时对象，避免每帧 GC
const _htHeadPos = new THREE.Vector3();
const _htTargetPos = new THREE.Vector3();
const _htDir = new THREE.Vector3();
const _htInvQuat = new THREE.Quaternion();
const _htEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const _htTargetQuat = new THREE.Quaternion();

function updateHeadTracking(delta) {
    const la = vrmInstance.lookAt;
    if (!la?.target) return;

    const headBone = vrmInstance.humanoid?.getNormalizedBoneNode('head');
    if (!headBone) return;

    // 头部 → 目标的方向向量
    headBone.getWorldPosition(_htHeadPos);
    la.target.getWorldPosition(_htTargetPos);
    _htDir.subVectors(_htTargetPos, _htHeadPos);

    // 转到角色本地空间（去掉角色自身旋转）
    vrmInstance.scene.getWorldQuaternion(_htInvQuat).invert();
    _htDir.applyQuaternion(_htInvQuat);

    // yaw = 左右转头, pitch = 上下点头
    const yaw = Math.atan2(_htDir.x, _htDir.z);
    const hDist = Math.sqrt(_htDir.x * _htDir.x + _htDir.z * _htDir.z);
    const pitch = Math.atan2(-_htDir.y, hDist);

    // 限制范围
    _htEuler.set(
        THREE.MathUtils.clamp(pitch, -HEAD_TRACK.maxPitch, HEAD_TRACK.maxPitch),
        THREE.MathUtils.clamp(yaw, -HEAD_TRACK.maxYaw, HEAD_TRACK.maxYaw),
        0,
    );
    _htTargetQuat.setFromEuler(_htEuler);

    // 平滑插值
    const t = 1 - Math.exp(-HEAD_TRACK.smoothSpeed * delta);
    headBone.quaternion.slerp(_htTargetQuat, t);
}

// ── 眨眼内部逻辑 ──────────────────────────────────────

function resetBlinkTimer() {
    blinkTimer = BLINK.minInterval + Math.random() * (BLINK.maxInterval - BLINK.minInterval);
    blinkPhase = 'idle';
    blinkValue = 0;
}

function updateBlink(delta) {
    const em = vrmInstance.expressionManager;
    if (!em) return;

    if (blinkPhase === 'idle') {
        blinkTimer -= delta;
        if (blinkTimer <= 0) {
            blinkPhase = 'closing';
        }
        return;
    }

    if (blinkPhase === 'closing') {
        blinkValue += delta / BLINK.closeSpeed;
        if (blinkValue >= 1) {
            blinkValue = 1;
            blinkPhase = 'opening';
        }
    } else if (blinkPhase === 'opening') {
        blinkValue -= delta / BLINK.openSpeed;
        if (blinkValue <= 0) {
            blinkValue = 0;
            resetBlinkTimer();
        }
    }

    em.setValue('blink', blinkValue);
}

// ── 表情呼吸内部逻辑 ──────────────────────────────────

function updateBreath(delta) {
    const em = vrmInstance.expressionManager;
    if (!em) return;

    breathTime += delta * BREATH.speed;
    // 正弦波 0~1~0，映射到 relaxed 表情
    const t = (Math.sin(breathTime * Math.PI * 2) * 0.5 + 0.5) * BREATH.amount;
    em.setValue('relaxed', t);
}
