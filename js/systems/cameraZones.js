/**
 * 相机区域系统：区域机位 + 限定范围轨道 + 角色弱跟随
 *
 * 设计（机位默认取 config.js 的 CAMERA_ZONES，场景切换时由
 * sceneManager 通过 setZones 换绑为当前场景的机位表）：
 *   - zone 模式（默认）：相机停在区域机位，只允许在限定范围内
 *     旋转/缩放（禁平移），永远不会转出该区域或穿墙迷路。
 *     角色走进带 bounds 的区域时相机自动平滑切换；离开回到首个机位。
 *   - follow 模式（按 F 或点「跟随」按钮）：恢复经典的角色跟随，
 *     但带死区——角色离 target 超过 CAMERA_FOLLOW_DEADZONE 才开始跟，
 *     小范围活动时镜头不动。
 *   - 切换机位时位置和 target 一起 smoothstep 插值，不硬切；
 *     过渡中用户按下指针可随时接管。
 *   - 调试：按 P 把当前相机位姿以 config 格式打印到控制台。
 */
import * as THREE from 'three';
import {
    CAMERA_ZONES, CAMERA_ZONE_CATEGORIES, CAMERA_ZONE_TRANSITION,
    CAMERA_FOLLOW_SPEED, CAMERA_FOLLOW_Y, CAMERA_FOLLOW_DEADZONE,
    ORBIT_MIN_DISTANCE, ORBIT_MAX_DISTANCE, ORBIT_MAX_POLAR,
} from '../config.js';
import { currentLang, LANG_CHANGE_EVENT } from '../ui.js';

let camera = null;
let controls = null;
let humanoid = null;

// 机位数据源（setZones 换绑；默认 config 的全局表）
let zones = CAMERA_ZONES;
let categories = CAMERA_ZONE_CATEGORIES;

let mode = 'zone';                    // 'zone' | 'follow'
let currentZone = null;
let transition = null;                // { t, fromPos, toPos, fromTarget, toTarget }

const _followTarget = new THREE.Vector3();

// ── 墙体碰撞收缩（方案B：target→相机打射线，撞墙就收距离）──
const COLLISION = {
    margin: 0.3,          // 相机离墙的最小间隙（米）
    minRadius: 0.3,       // 收缩下限，防止贴脸穿模
    growSpeed: 8,         // 障碍消失后距离恢复速度（指数趋近）
    zoomEps: 0.03,        // 判定「用户主动缩放」的半径差阈值
};
let collisionMeshes = [];   // 参与碰撞的 mesh（房子/岛屿/门，模型就绪后注入）
let userRadius = 0;         // 用户想要的轨道半径（缩放输入会更新它）
let appliedRadius = 0;      // 实际施加的半径（被墙收缩后 < userRadius）
const _colRay = new THREE.Raycaster();
const _colDir = new THREE.Vector3();

// ── 初始化 ──────────────────────────────────────────────

export function initCameraZones(cam, ctrl, renderer, humanoidGroup) {
    camera = cam;
    controls = ctrl;
    humanoid = humanoidGroup;

    // 语言切换后重刷按钮文案
    window.addEventListener(LANG_CHANGE_EVENT, refreshButtons);

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

    setZones(CAMERA_ZONES, CAMERA_ZONE_CATEGORIES);
}

/**
 * 换绑机位表（场景切换时调用）：重建按钮、重置到首个机位、取消进行中的过渡
 * @param {Array} newZones - 机位数组（结构同 config.CAMERA_ZONES 项）
 * @param {Array} newCategories - 分组数组（结构同 config.CAMERA_ZONE_CATEGORIES 项）
 */
export function setZones(newZones, newCategories = []) {
    zones = newZones;
    categories = newCategories;
    // 保留用户已有的折叠状态，新分组默认展开
    collapsed = Object.fromEntries(categories.map(c => [c.id, collapsed[c.id] ?? false]));
    transition = null;
    controls.enabled = true;
    goToZone(zones[0], true);
    buildButtons();
}

/**
 * 注入相机碰撞体（模型加载完成后调用一次）
 * @param {THREE.Object3D} root - 房子/岛屿容器，取其中所有可见 mesh
 */
export function setCameraCollisionRoot(root) {
    collisionMeshes = [];
    root.updateWorldMatrix(true, true);
    root.traverse((child) => {
        if (child.isMesh && child.visible) collisionMeshes.push(child);
    });
    console.log(`[CameraZones] 碰撞 mesh 数: ${collisionMeshes.length}`);
}

// ── 每帧更新（在 animate 中调用）─────────────────────────

export function updateCameraZones(delta) {
    if (transition) {
        updateTransition(delta);
        return;
    }
    if (!humanoid?.userData.vrm) {
        applyWallCollision(delta);
        return;
    }

    if (mode === 'follow') {
        // 死区弱跟随：角色没走远镜头不动
        const dx = humanoid.position.x - controls.target.x;
        const dz = humanoid.position.z - controls.target.z;
        if (Math.hypot(dx, dz) > CAMERA_FOLLOW_DEADZONE) {
            const t = 1 - Math.exp(-CAMERA_FOLLOW_SPEED * delta);
            _followTarget.set(humanoid.position.x, CAMERA_FOLLOW_Y, humanoid.position.z);
            controls.target.lerp(_followTarget, t);
        }
    } else {
        // zone 模式：按角色位置自动切换
        const z = zoneAt(humanoid.position.x, humanoid.position.z);
        if (z && z !== currentZone) {
            goToZone(z);
        } else if (!z && currentZone?.bounds) {
            goToZone(zones[0]);   // 离开触发区 -> 回全景
        }
    }

    applyWallCollision(delta);
}

// ── 墙体碰撞收缩 ────────────────────────────────────────
// 每帧从 target 向相机方向打射线，撞到墙就把距离收回来；
// 墙消失后平滑恢复到用户想要的半径。收缩立即、恢复渐进。

function applyWallCollision(delta) {
    if (!controls.enabled) return;
    // 室外机位（全景/庭院/背面）target 常在屋内，做收缩会把相机拉进房子——跳过；
    // 室内机位和跟随模式才需要「相机出不了房间」
    if (mode === 'zone' && currentZone?.category === 'outside') return;

    const target = controls.target;
    _colDir.subVectors(camera.position, target);
    const dist = _colDir.length();
    if (dist < 1e-4) return;
    _colDir.divideScalar(dist);

    // 实际半径与上帧施加值不同 -> 用户主动缩放了，更新期望半径
    if (Math.abs(dist - appliedRadius) > COLLISION.zoomEps) userRadius = dist;
    userRadius = THREE.MathUtils.clamp(userRadius, controls.minDistance, controls.maxDistance);

    let allowed = userRadius;
    if (collisionMeshes.length > 0) {
        _colRay.set(target, _colDir);
        _colRay.far = userRadius;
        const hits = _colRay.intersectObjects(collisionMeshes, false);
        if (hits.length > 0) {
            allowed = Math.min(allowed, Math.max(COLLISION.minRadius, hits[0].distance - COLLISION.margin));
        }
    }

    if (allowed < appliedRadius) {
        appliedRadius = allowed;    // 收缩立即生效，不穿墙
    } else {
        const t = 1 - Math.exp(-COLLISION.growSpeed * delta);
        appliedRadius += (allowed - appliedRadius) * t;
    }

    if (Math.abs(appliedRadius - dist) > 0.005) {
        camera.position.copy(target).addScaledVector(_colDir, appliedRadius);
    }
}

function resetRadius() {
    userRadius = appliedRadius = camera.position.distanceTo(controls.target);
}

// ── 内部 ────────────────────────────────────────────────

function zoneAt(x, z) {
    return zones.find(zone =>
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
        resetRadius();
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
        resetRadius();
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
        // 回区域模式：切到角色所在区域（无则首个机位）
        transition = null;
        controls.enabled = true;
        goToZone(zoneAt(humanoid.position.x, humanoid.position.z) ?? zones[0]);
    } else {
        mode = 'follow';
        transition = null;
        controls.enabled = true;
        applyFollowConstraints();
        resetRadius();
        refreshButtons();
    }
}

// ── 机位按钮（按 category 分组，可折叠）────────────────────

// 各分组折叠状态，默认全部展开（setZones 时按新分组重建，保留已有状态）
let collapsed = {};

function buildButtons() {
    const bar = document.getElementById('camera-bar');
    if (!bar) return;
    bar.innerHTML = '';
    for (const cat of categories) {
        const group = document.createElement('div');
        group.className = 'cam-group';
        group.dataset.category = cat.id;

        const header = document.createElement('button');
        header.className = 'cam-group-header';
        header.dataset.category = cat.id;
        header.addEventListener('click', () => {
            collapsed[cat.id] = !collapsed[cat.id];
            refreshButtons();
        });
        group.appendChild(header);

        const body = document.createElement('div');
        body.className = 'cam-group-body';
        for (const zone of zones.filter(z => z.category === cat.id)) {
            const btn = document.createElement('button');
            btn.className = 'cam-zone-btn';
            btn.dataset.zone = zone.id;
            btn.addEventListener('click', () => {
                if (zone !== currentZone || mode !== 'zone') goToZone(zone);
            });
            body.appendChild(btn);
        }
        group.appendChild(body);
        bar.appendChild(group);
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
    // 当前机位所在分组强制展开，其余按用户折叠状态
    const activeCat = mode === 'zone' ? currentZone?.category : null;
    for (const group of bar.querySelectorAll('.cam-group')) {
        const catId = group.dataset.category;
        const cat = categories.find(c => c.id === catId);
        const isCollapsed = collapsed[catId] && catId !== activeCat;
        group.querySelector('.cam-group-body').style.display = isCollapsed ? 'none' : '';
        const header = group.querySelector('.cam-group-header');
        // cat 可能为 undefined：setZones 里 goToZone 先于 buildButtons，
        // 此时 DOM 还是旧分组而新 categories 里没有它
        header.textContent = `${isCollapsed ? '▸' : '▾'} ${cat ? (en ? cat.nameEn : cat.name) : catId}`;
    }
    for (const btn of bar.querySelectorAll('.cam-zone-btn')) {
        if (btn.classList.contains('cam-follow-btn')) {
            btn.textContent = en ? 'Follow' : '跟随';
            btn.classList.toggle('active', mode === 'follow');
        } else {
            // zone 可能为 undefined：setZones 里 goToZone 先于 buildButtons，
            // 此时 DOM 还是旧机位按钮而新 zones 里没有它
            const zone = zones.find(z => z.id === btn.dataset.zone);
            if (!zone) continue;
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
