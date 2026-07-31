/**
 * 场景管理器：动森式独立场景切换（室外 / 各室内房间）
 *
 * 设计：
 *   - 单 THREE.Scene，场景内容是挂在其中的容器 Group；
 *     切场景 = 旧容器 visible=false + 新容器 visible=true。
 *   - 室外容器常驻（季节/门状态不丢）；室内容器按需加载并缓存，
 *     同一时刻只有一个场景可见。
 *   - 切换流程：淡出遮罩 → 停用旧场景 → 加载/激活新场景 →
 *     onActivated 钩子（重建导航/机位/门/相机碰撞/角色落点）→ 淡入。
 *   - 遮罩显示期间 pointer-events 拦截全部指针输入，天然锁输入。
 *
 * 场景定义在 config.js 的 SCENES；门上的 extras
 * （door_target_scene / door_target_spawn）是本模块的触发入口。
 */
import { SCENES } from '../config.js';

const FADE_MS = 300;   // 应与 index.html #fade-overlay 的 transition 时长一致

let threeScene = null;
let hooks = {};            // { loadScene, onDeactivate, onActivated }
let activeId = null;
let transitioning = false;
let fadeEl = null;
const containers = new Map();   // sceneId → THREE.Group

/**
 * @param {{ scene: THREE.Scene, hooks?: {
 *   loadScene?: (def) => Promise<THREE.Group|null>,
 *   onDeactivate?: (sceneId: string) => void,
 *   onActivated?: (def, group: THREE.Group, spawnId?: string) => void,
 * } }} ctx
 */
export function initSceneManager({ scene, hooks: hk }) {
    threeScene = scene;
    hooks = hk ?? {};
    fadeEl = document.getElementById('fade-overlay');
}

/** 登记已加载的场景容器（如室外 houseShell group） */
export function registerSceneContainer(sceneId, group) {
    containers.set(sceneId, group);
}

/** 标记初始场景（启动时调用一次，无过渡） */
export function setInitialScene(sceneId) {
    activeId = sceneId;
}

export function getActiveScene() {
    return activeId;
}

export function isTransitioning() {
    return transitioning;
}

function fade(on) {
    return new Promise(resolve => {
        if (!fadeEl) { resolve(); return; }
        fadeEl.classList.toggle('on', on);
        setTimeout(resolve, FADE_MS);
    });
}

/**
 * 切换到目标场景
 * @param {string} sceneId - SCENES 中的场景 id
 * @param {string} [spawnId] - 落点 id（缺省用场景的 default 落点）
 * @returns {Promise<boolean>} 是否实际发生了切换
 */
export async function switchTo(sceneId, spawnId) {
    if (transitioning || sceneId === activeId) return false;
    const def = SCENES.find(s => s.id === sceneId);
    if (!def) {
        console.warn(`[SceneManager] 未知场景 ${sceneId}`);
        return false;
    }

    transitioning = true;
    await fade(true);

    // 停用旧场景
    const oldGroup = containers.get(activeId);
    if (oldGroup) oldGroup.visible = false;
    hooks.onDeactivate?.(activeId);

    // 激活新场景（未加载则走 loadScene 钩子，失败则回滚）
    let group = containers.get(sceneId);
    if (!group) {
        group = await hooks.loadScene?.(def);
        if (!group) {
            console.error(`[SceneManager] 场景 ${sceneId} 加载失败，回滚`);
            if (oldGroup) oldGroup.visible = true;
            await fade(false);
            transitioning = false;
            return false;
        }
        threeScene.add(group);
        containers.set(sceneId, group);
    }
    group.visible = true;
    activeId = sceneId;
    hooks.onActivated?.(def, group, spawnId);

    await fade(false);
    transitioning = false;
    return true;
}
