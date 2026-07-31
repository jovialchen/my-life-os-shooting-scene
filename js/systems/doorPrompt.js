/**
 * 传送门提示：走近带 door_target_scene 的门 ≤1.2m 显示气泡
 * （"按 E 进入 xx"，跟随 currentLang），按 E 触发场景切换。
 *
 * 气泡是 DOM（#door-prompt，见 index.html），每帧投影到门的屏幕位置。
 * 点击门本身也会触发（doors.js 的 onDoorTrigger），本模块是键盘路径。
 */
import * as THREE from 'three';
import { getDoors } from './doors.js';
import { currentLang } from '../ui.js';

const TRIGGER_DIST = 1.2;   // 触发距离（米，到门板中心的水平距离）

let el = null;
let humanoid = null;
let camera = null;
let getLabel = null;    // (sceneId) => 显示名
let onTrigger = null;   // (door) => void
let nearDoor = null;

const _center = new THREE.Vector3();
const _box = new THREE.Box3();

/**
 * @param {{ humanoid: THREE.Object3D, camera: THREE.Camera,
 *   getLabel: (sceneId: string) => string,
 *   onTrigger: (door) => void }} ctx
 */
export function initDoorPrompt({ humanoid: h, camera: c, getLabel: gl, onTrigger: ot }) {
    humanoid = h;
    camera = c;
    getLabel = gl;
    onTrigger = ot;
    el = document.getElementById('door-prompt');
    window.addEventListener('keydown', (e) => {
        if (e.code === 'KeyE' && nearDoor && !e.repeat) onTrigger?.(nearDoor);
    });
}

/** 每帧更新（在 animate 中调用）：找最近的可传送门，显示/隐藏气泡 */
export function updateDoorPrompt() {
    nearDoor = null;
    let best = TRIGGER_DIST;
    for (const d of getDoors()) {
        if (!d.targetScene) continue;
        _box.setFromObject(d.obj).getCenter(_center);
        const dx = _center.x - humanoid.position.x;
        const dz = _center.z - humanoid.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist < best) {
            best = dist;
            nearDoor = d;
        }
    }
    if (!el) return;
    if (!nearDoor) {
        el.classList.remove('show');
        return;
    }
    const name = getLabel(nearDoor.targetScene);
    const zh = currentLang() !== 'en';
    el.textContent = nearDoor.targetScene === 'outdoor'
        ? (zh ? `按 E 回到${name}` : `Press E to exit`)
        : (zh ? `按 E 进入${name}` : `Press E to enter ${name}`);
    // 投影到门板中心上方
    _box.setFromObject(nearDoor.obj).getCenter(_center);
    _center.y += 0.6;
    _center.project(camera);
    if (_center.z > 1) {   // 门在相机背后
        el.classList.remove('show');
        return;
    }
    el.style.left = `${(_center.x * 0.5 + 0.5) * innerWidth}px`;
    el.style.top = `${(-_center.y * 0.5 + 0.5) * innerHeight}px`;
    el.classList.add('show');
}
