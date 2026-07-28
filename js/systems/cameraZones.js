/**
 * 相机区域系统：区域机位 + 限定范围轨道 + 角色弱跟随
 *
 * 设计（机位定义在 config.js 的 CAMERA_ZONES）：
 *   - zone 模式（默认）：相机停在区域机位，只允许在限定范围内
 *     旋转/缩放（禁平移），永远不会转出该区域或穿墙迷路。
 *     角色走进带 bounds 的区域时相机自动平滑切换；离开回到「全景」。
 *   - follow 模式（按 F 或点「跟随」按钮）：恢复经典的角色跟随，
 *     但带死区——角色离 target 超过 CAMERA_FOLLOW_DEADZONE 才开始跟，
 *     小范围活动时镜头不动。
 *   - 切换机位时位置和 target 一起 smoothstep 插值，不硬切；
 *     过渡中用户按下指针可随时接管。
 *   - 调试：按 P 把当前相机位姿以 config 格式打印到控制台。
 */
import * as THREE from 'three';
import {
    CAMERA_ZONES, CAMERA_ZONE_TRANSITION,
    CAMERA_FOLLOW_SPEED, CAMERA_FOLLOW_Y, CAMERA_FOLLOW_DEADZONE,
    ORBIT_MIN_DISTANCE, ORBIT_MAX_DISTANCE, ORBIT_MAX_POLAR,
} from '../config.js';
import { currentLang } from '../ui.js';

let camera = null;
let controls = null;
let humanoid = null;

let mode = 'zone';                    // 'zone' | 'follow'
let currentZone = CAMERA_ZONES[0];
let transition = null;                // { t, fromPos, toPos, fromTarget, toTarget }

const _followTarget = new THREE.Vector3();

// ── 初始化 ──────────────────────────────────────────────

export function initCameraZones(cam, ctrl, renderer, humanoidGroup) {
    camera = cam;
    controls = ctrl;
    humanoid = humanoidGroup;

    buildButtons();

    // 过渡中用户按下指针 -> 立即接管
    renderer.domElement.addEventListener('pointerdown', () => {
        if (transition) {
            transition = null;
            controls.enabled = true;
            applyConstraints(currentZone);
        }
    });

    window.addEventListener('keydown', (e) => {
        if (e.code === 'KeyF') toggleFollow();
        if (e.code === 'KeyP') printPose();
    });

    goToZone(CAMERA_ZONES[0], true);
}

// ── 每帧更新（在 animate 中调用）─────────────────────────

export function updateCameraZones(delta) {
    if (transition) {
        updateTransition(delta);
        return;
    }
    if (!humanoid?.userData.vrm) return;

    if (mode === 'follow') {
        // 死区弱跟随：角色没走远镜头不动
        const dx = humanoid.position.x - controls.target.x;
        const dz = humanoid.position.z - controls.target.z;
        if (Math.hypot(dx, dz) > CAMERA_FOLLOW_DEADZONE) {
            const t = 1 - Math.exp(-CAMERA_FOLLOW_SPEED * delta);
            _followTarget.set(humanoid.position.x, CAMERA_FOLLOW_Y, humanoid.position.z);
            controls.target.lerp(_followTarget, t);
        }
        return;
    }

    // zone 模式：按角色位置自动切换
    const z = zoneAt(humanoid.position.x, humanoid.position.z);
    if (z && z !== currentZone) {
        goToZone(z);
    } else if (!z && currentZone.bounds) {
        goToZone(CAMERA_ZONES[0]);   // 离开触发区 -> 回全景
    }
}

// ── 内部 ────────────────────────────────────────────────

function zoneAt(x, z) {
    return CAMERA_ZONES.find(zone =>
        zone.bounds
        && zone.bounds.x[0] <= x && x <= zone.bounds.x[1]
        && zone.bounds.z[0] <= z && z <= zone.bounds.z[1]) ?? null;
}

function goToZone(zone, instant = false) {
    currentZone = zone;
    mode = 'zone';
    refreshButtons();
    if (instant) {
        camera.position.set(...zone.pos);
        controls.target.set(...zone.target);
        applyConstraints(zone);
        controls.update();
        return;
    }
    transition = {
        t: 0,
        fromPos: camera.position.clone(),
        toPos: new THREE.Vector3(...zone.pos),
        fromTarget: controls.target.clone(),
        toTarget: new THREE.Vector3(...zone.target),
    };
    controls.enabled = false;
}

function updateTransition(delta) {
    transition.t += delta / CAMERA_ZONE_TRANSITION;
    const k = smooth01(Math.min(transition.t, 1));
    camera.position.lerpVectors(transition.fromPos, transition.toPos, k);
    controls.target.lerpVectors(transition.fromTarget, transition.toTarget, k);
    if (transition.t >= 1) {
        transition = null;
        controls.enabled = true;
        applyConstraints(currentZone);
    }
}

function smooth01(t) {
    return t * t * (3 - 2 * t);
}

function applyConstraints(zone) {
    controls.minDistance = zone.minDist;
    controls.maxDistance = zone.maxDist;
    controls.minPolarAngle = zone.minPolar ?? 0;
    controls.maxPolarAngle = zone.maxPolar;
    controls.enablePan = false;
}

function applyFollowConstraints() {
    controls.minDistance = ORBIT_MIN_DISTANCE;
    controls.maxDistance = ORBIT_MAX_DISTANCE;
    controls.minPolarAngle = 0;
    controls.maxPolarAngle = ORBIT_MAX_POLAR;
    controls.enablePan = true;
}

function toggleFollow() {
    if (mode === 'follow') {
        // 回区域模式：切到角色所在区域（无则全景）
        transition = null;
        controls.enabled = true;
        goToZone(zoneAt(humanoid.position.x, humanoid.position.z) ?? CAMERA_ZONES[0]);
    } else {
        mode = 'follow';
        transition = null;
        controls.enabled = true;
        applyFollowConstraints();
        refreshButtons();
    }
}

// ── 机位按钮 ────────────────────────────────────────────

function buildButtons() {
    const bar = document.getElementById('camera-bar');
    if (!bar) return;
    for (const zone of CAMERA_ZONES) {
        const btn = document.createElement('button');
        btn.className = 'cam-zone-btn';
        btn.dataset.zone = zone.id;
        btn.addEventListener('click', () => {
            if (zone !== currentZone || mode !== 'zone') goToZone(zone);
        });
        bar.appendChild(btn);
    }
    const followBtn = document.createElement('button');
    followBtn.className = 'cam-zone-btn cam-follow-btn';
    followBtn.addEventListener('click', toggleFollow);
    bar.appendChild(followBtn);
    refreshButtons();
}

function refreshButtons() {
    const bar = document.getElementById('camera-bar');
    if (!bar) return;
    const en = currentLang() === 'en';
    for (const btn of bar.querySelectorAll('.cam-zone-btn')) {
        if (btn.classList.contains('cam-follow-btn')) {
            btn.textContent = en ? 'Follow' : '跟随';
            btn.classList.toggle('active', mode === 'follow');
        } else {
            const zone = CAMERA_ZONES.find(z => z.id === btn.dataset.zone);
            btn.textContent = en ? zone.nameEn : zone.name;
            btn.classList.toggle('active', mode === 'zone' && zone === currentZone);
        }
    }
}

// ── 调试 ────────────────────────────────────────────────

/** 把当前相机位姿按 config 格式打印到控制台（按键 P） */
function printPose() {
    const p = camera.position, t = controls.target;
    console.log(
        `pos: [${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}], `
        + `target: [${t.x.toFixed(2)}, ${t.y.toFixed(2)}, ${t.z.toFixed(2)}],`
    );
}

export function getCameraZonesDebug() {
    return { mode, currentZone, goToZone, printPose };
}
