/**
 * 主入口：场景初始化 + 各系统组装 + 动画循环
 *
 * 场景组成：
 *   - 岛屿地面（models/island.glb：可行走顶面 + 四季树）+ GLB 房子模型
 *   - VRM 人物（character/humanoid.js，models/hazel-pink.vrm）
 *   - 相机（区域机位 + 限定范围轨道 + 跟随模式，systems/cameraZones.js）
 *   - 灯光系统（systems/lighting.js：环境光 + 太阳 + 补光 + 窗光）
 *   - 时间系统（systems/timeOfDay.js：6 时段平滑过渡）
 *   - 季节系统（systems/seasons.js：草地颜色 + 树叶变色/落叶）
 *   - 门交互（systems/doors.js：点击开/关门）
 *   - UI（ui.js：时间/季节滑块、语言切换、指南针）
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }     from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass }     from 'three/addons/postprocessing/OutputPass.js';

import {
    BG_COLOR,
    CAMERA_FOV, CAMERA_NEAR, CAMERA_FAR, CAMERA_POS, CAMERA_TARGET,
    TONE_MAPPING_EXPOSURE,
    BLOOM_STRENGTH, BLOOM_RADIUS, BLOOM_THRESHOLD,
    ORBIT_DAMPING, ORBIT_MIN_DISTANCE, ORBIT_MAX_DISTANCE, ORBIT_MAX_POLAR, MAX_PIXEL_RATIO,
} from './config.js';

// 角色系统 ──
import { createHumanoid, updateHumanoid, setHumanoidLookAt } from './character/humanoid.js';
import { initWalker, updateWalker } from './character/walker.js';
import { initApartmentGrid, rebuildGrid, setTreePositions } from './character/pathfinding.js';

// ── 外壳房子（草地 + GLB 模型）──
import { createHouseShell } from './elements/houseShell.js';

// ── 各系统 ──
import { initSeasons, updateSeason } from './systems/seasons.js';
import { initDoors, updateDoors, getDoors, pickDoorAt } from './systems/doors.js';
import { createLighting } from './systems/lighting.js';
import { createTimeOfDay } from './systems/timeOfDay.js';
import { initCameraZones, updateCameraZones, getCameraZonesDebug } from './systems/cameraZones.js';

// ── UI ──
import { initUI, updateCompass } from './ui.js';

// ============================================================
//  场景 / 相机 / 渲染器
// ============================================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(BG_COLOR);

const camera = new THREE.PerspectiveCamera(CAMERA_FOV, innerWidth / innerHeight, CAMERA_NEAR, CAMERA_FAR);
camera.position.set(CAMERA_POS.x, CAMERA_POS.y, CAMERA_POS.z);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, MAX_PIXEL_RATIO));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = TONE_MAPPING_EXPOSURE;
document.body.appendChild(renderer.domElement);

// ============================================================
//  相机控制器
// ============================================================
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(CAMERA_TARGET.x, CAMERA_TARGET.y, CAMERA_TARGET.z);
controls.enableDamping = true;
controls.dampingFactor = ORBIT_DAMPING;
controls.minDistance = ORBIT_MIN_DISTANCE;
controls.maxDistance = ORBIT_MAX_DISTANCE;
controls.maxPolarAngle = ORBIT_MAX_POLAR;
controls.update();

// ── 动画时钟 ──
const clock = new THREE.Clock();
let lookAtBound = false;

// ============================================================
//  岛屿地面 + 房子
// ============================================================
let seasonValue = 0;   // 当前季节滑块值（岛屿加载完成后补刷）

const { group: houseShellGroup, grass } = createHouseShell({
    onIslandLoaded: ({ trees, leaves, grassMaterials }) => {
        // 树干成为寻路障碍
        setTreePositions(trees);
        rebuildGrid(null, null, null, null, grass);
        // 季节系统接管草地/树叶
        initSeasons({ grassMaterials, leaves });
        updateSeason(seasonValue);
    },
});
scene.add(houseShellGroup);

// ============================================================
//  寻路网格（仅草地范围；树干障碍在岛屿加载后重建）
// ============================================================
initApartmentGrid(null, null, grass);
rebuildGrid(null, null, null, null, grass);

// ============================================================
//  季节系统（草地 + 树叶；具体目标在岛屿加载后注入）
// ============================================================
initSeasons();

// ============================================================
//  角色
// ============================================================
const humanoid = createHumanoid();
scene.add(humanoid);

// 门交互（必须在 initWalker 之前注册，点到门时阻止角色走动）
initDoors(camera, renderer);

// 角色点击走动
initWalker(humanoid, camera, renderer, scene, null, null, grass);

// 相机区域系统（机位切换 + 跟随模式）
initCameraZones(camera, controls, renderer, humanoid);

// ============================================================
//  灯光 + 时间系统
// ============================================================
const lighting = createLighting(scene);
const timeOfDay = createTimeOfDay(scene, lighting);
timeOfDay.update(2); // 默认中午

// ============================================================
//  UI（时间/季节滑块、语言切换）
// ============================================================
initUI({
    onTimeChange: (v) => timeOfDay.update(v),
    onSeasonChange: (v) => { seasonValue = v; updateSeason(v); },
});

// ============================================================
//  后期处理
// ============================================================
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloom = new UnrealBloomPass(
    new THREE.Vector2(innerWidth, innerHeight),
    BLOOM_STRENGTH, BLOOM_RADIUS, BLOOM_THRESHOLD
);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ============================================================
//  响应窗口大小变化
// ============================================================
window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
});

// ============================================================
//  动画循环
// ============================================================
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    controls.update();

    // 相机区域系统（自动切换机位 / 跟随模式 / 过渡动画）
    updateCameraZones(delta);

    updateCompass(camera, controls);

    // 角色头部追踪相机（首次绑定）
    if (!lookAtBound && humanoid.userData.vrm) {
        setHumanoidLookAt(camera);
        lookAtBound = true;
    }

    updateHumanoid(delta);
    updateWalker(delta);
    updateDoors(delta);

    composer.render();
}
animate();

// 调试句柄（控制台/自动化测试用）：window.__app
window.__app = { scene, camera, controls, getDoors, pickDoorAt, humanoid, timeOfDay, lighting, camZones: getCameraZonesDebug() };
