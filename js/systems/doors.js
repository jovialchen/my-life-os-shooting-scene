/**
 * 门/窗帘交互系统：点击 → 开/关动画
 *
 * 门板来自 GLB 中带 custom property `interactable_type = "door"` 的物体，
 * 建模规范见 doc/blender-workflow-instructions.md「二、门的制作」：
 *   - origin 在铰链侧（平开门绕 origin 旋转）
 *   - door_swing_angle: 平开=最大角度(度)，推拉=滑动距离(米)
 *   - door_swing_dir: "left" / "right"（从铰链侧看）
 *   - door_slide: 平开=False，推拉=True
 *   - door_locked: 是否锁住
 *
 * 窗帘来自 `interactable_type = "curtain"` 的物体（建模规范见
 * doc/design-surface-system.md）：
 *   - origin 在帘布外侧边缘，开帘 = scale.x 收拢成褶
 *   - curtain_group: 同组帘片联动开关（如一副帘的左右两片）
 *   - 必须同时标 nav_ignore（窗帘永不进导航/障碍）
 *
 * 注意：initDoors 必须在 initWalker 之前调用，
 * 这样点到门时 walker 能通过 consumeDoorTap() 知道「这次点击是点门」，
 * 不让角色走过去（不能用 stopImmediatePropagation 吞 pointerup：
 * OrbitControls 的 pointerup 监听器注册更靠后，会被一起吞掉，
 * 导致它永远卡在拖拽状态、之后的单指拖动被当成双指手势而无法旋转）。
 *
 * 命中检测在 pointerdown 时做（而不是 pointerup）：
 * 相机会每帧向角色跟随目标漂移，慢一点的点击（100ms+）在 pointerup 时
 * 门板已经滑出光标位置，用 pointerup 的坐标做射线会打空。
 */
import * as THREE from 'three';
import { CLICK_DRAG_THRESHOLD } from '../config.js';

const DOOR_SPEED = 1.5;    // 开/关进度速度（0→1 约 0.67s）
const CURTAIN_GATHER = 0.12;   // 窗帘收拢后的宽度比例（1=全闭 → 0.12=收成褶堆）

const doors = [];          // 已注册的门
let camera = null;
let onDoorToggle = null;   // 门开合状态变化回调（导航网格重建用）
let onDoorTrigger = null;  // 传送门触发回调（door_target_scene 存在时）

/** 注册门开合回调（导航动态障碍重建） */
export function setOnDoorToggle(fn) {
    onDoorToggle = fn;
}

/**
 * 注册传送门触发回调（动森式场景切换）
 * 点击带 door_target_scene 的门：开门动画照播，同时回调触发 switchTo
 */
export function setOnDoorTrigger(fn) {
    onDoorTrigger = fn;
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let pointerDownPos = null;
let hitDoor = null;        // pointerdown 时命中的门
let tapOnDoor = false;     // 本次 pointerup 点在门上（walker 据此抑制走动，消费一次）

/** walker 用：这次 pointerup 是否点在了门上（读到即清零） */
export function consumeDoorTap() {
    const v = tapOnDoor;
    tapOnDoor = false;
    return v;
}

/** 射线检测指定屏幕坐标处的门（pointerdown 用，也可作调试 API） */
export function pickDoorAt(clientX, clientY) {
    if (!camera || doors.length === 0) return null;
    pointer.x = (clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(doors.map(d => d.obj), true);
    if (hits.length === 0) return null;
    const obj = hits[0].object;
    return doors.find(d => d.obj === obj || d.obj === obj.parent) ?? null;
}

/**
 * 初始化门交互（只调用一次，在 initWalker 之前）
 * @param {THREE.Camera} cam
 * @param {THREE.WebGLRenderer} renderer
 */
export function initDoors(cam, renderer) {
    camera = cam;
    const el = renderer.domElement;

    el.addEventListener('pointerdown', e => {
        pointerDownPos = { x: e.clientX, y: e.clientY };
        hitDoor = pickDoorAt(e.clientX, e.clientY);
    });

    el.addEventListener('pointerup', e => {
        if (!pointerDownPos) return;
        const dx = e.clientX - pointerDownPos.x;
        const dy = e.clientY - pointerDownPos.y;
        pointerDownPos = null;
        if (Math.hypot(dx, dy) > CLICK_DRAG_THRESHOLD) {
            hitDoor = null;
            return;
        }
        if (!hitDoor) return;

        toggleDoor(hitDoor);
        hitDoor = null;
        // 标记本次点击是点门（walker 的 pointerup 随后触发，据此不走动）
        tapOnDoor = true;
    });
}

/**
 * 返回已注册的门（调试用）
 */
export function getDoors() {
    return doors;
}

/**
 * 清空已注册的门（场景切换卸载旧场景时调用）
 * 开合状态暂存到 obj.userData._doorState，重新注册时恢复
 * （室外容器常驻，门开着切走再切回要保持原样）
 */
export function clearDoors() {
    for (const d of doors) {
        d.obj.userData._doorState = {
            openT: d.openT, targetT: d.targetT,
            baseRotY: d.baseRotY, basePos: d.basePos, baseScaleX: d.baseScaleX,
        };
    }
    doors.length = 0;
    hitDoor = null;
}

/**
 * 注册一个可交互物体（GLB 加载后由 houseShell / main 调用）
 * @param {THREE.Object3D} obj - userData.interactable_type 为 'door' 或 'curtain' 的物体
 */
export function registerDoor(obj) {
    const ud = obj.userData;
    const saved = ud._doorState ?? null;   // clearDoors 暂存的开合状态
    const door = {
        obj,
        kind: ud.interactable_type === 'curtain' ? 'curtain' : 'door',
        curtainGroup: ud.curtain_group ?? null,   // 同组帘片联动（仅窗帘）
        slide: ud.door_slide === true,
        swing: THREE.MathUtils.degToRad(ud.door_swing_angle ?? 90),
        dir: ud.door_swing_dir === 'left' ? -1 : 1,
        locked: ud.door_locked === true,
        targetScene: ud.door_target_scene ?? null,   // 传送目标场景（无则普通门）
        targetSpawn: ud.door_target_spawn ?? null,   // 目标场景落点 id
        openT: saved?.openT ?? 0,  // 当前开度 0=关 1=开
        targetT: saved?.targetT ?? 0,
        baseRotY: saved?.baseRotY ?? obj.rotation.y,
        basePos: saved?.basePos ?? obj.position.clone(),
        baseScaleX: saved?.baseScaleX ?? obj.scale.x,   // 窗帘收拢基准
    };
    doors.push(door);
    console.log(`[Doors] 注册${door.kind === 'curtain' ? '窗帘' : '门'} ${obj.name}: slide=${door.slide} swing=${ud.door_swing_angle} dir=${ud.door_swing_dir} locked=${door.locked}`);
}

function toggleDoor(door) {
    if (door.locked) {
        console.log(`[Doors] ${door.obj.name} 锁住了`);
        return;
    }
    // 窗帘：同 curtain_group 的所有帘片联动（一副帘点哪片都整副开合）
    const group = door.kind === 'curtain' && door.curtainGroup
        ? doors.filter(d => d.kind === 'curtain' && d.curtainGroup === door.curtainGroup)
        : [door];
    const opening = door.targetT <= 0.5;
    for (const d of group) d.targetT = opening ? 1 : 0;
    if (door.kind === 'door') onDoorToggle?.();
    // 传送门：开门动画照播，同时触发场景切换（淡出遮罩盖住动画）
    if (opening && door.targetScene) onDoorTrigger?.(door);
}

function easeInOut(t) {
    return t * t * (3 - 2 * t);
}

/**
 * 每帧更新门动画（在 animate 中调用）
 * @param {number} delta - 帧间隔秒数
 */
export function updateDoors(delta) {
    for (const d of doors) {
        if (d.openT === d.targetT) continue;
        const step = DOOR_SPEED * delta;
        d.openT = Math.abs(d.targetT - d.openT) <= step
            ? d.targetT
            : d.openT + Math.sign(d.targetT - d.openT) * step;

        const e = easeInOut(d.openT);
        if (d.kind === 'curtain') {
            // 窗帘：origin 在外侧边缘，scale.x 收拢成褶堆
            d.obj.scale.x = d.baseScaleX * (1 + (CURTAIN_GATHER - 1) * e);
        } else if (d.slide) {
            // 推拉门：door_swing_angle 是滑动距离（米），沿门板宽度方向(local X)
            d.obj.position.x = d.basePos.x + d.dir * d.swing * e;
        } else {
            d.obj.rotation.y = d.baseRotY + d.dir * d.swing * e;
        }
    }
}
