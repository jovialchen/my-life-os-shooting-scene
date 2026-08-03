/**
 * 主入口：场景初始化 + 各系统组装 + 动画循环
 *
 * 场景组成：
 *   - 岛屿地面（models/island.glb：可行走顶面 + 四季树）+ GLB 房子模型
 *   - VRM 人物（character/humanoid.js，models/hazel-pink.vrm）
 *   - 相机（区域机位 + 限定范围轨道 + 跟随模式，systems/cameraZones.js）
 *   - 灯光系统（systems/lighting.js：环境光 + 太阳 + 补光 + 窗光）
 *   - 时间系统（systems/timeOfDay.js：6 时段平滑过渡）
 *   - 季节系统（systems/seasons.js：草地/树木/花果/雪盖/雪人）
 *   - 门交互（systems/doors.js：点击开/关门）
 *   - 场景管理（systems/sceneManager.js：动森式独立场景切换，门=传送点）
 *   - UI（ui.js：时间/季节滑块、语言切换、指南针）
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }     from 'three/addons/postprocessing/RenderPass.js';
import { OutlinePass }    from 'three/addons/postprocessing/OutlinePass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass }     from 'three/addons/postprocessing/OutputPass.js';

import {
    BG_COLOR,
    CAMERA_FOV, CAMERA_NEAR, CAMERA_FAR, CAMERA_POS, CAMERA_TARGET,
    TONE_MAPPING_EXPOSURE,
    BLOOM_STRENGTH, BLOOM_RADIUS, BLOOM_THRESHOLD,
    OUTLINE_STRENGTH, OUTLINE_THICKNESS, OUTLINE_COLOR,
    ORBIT_DAMPING, ORBIT_MIN_DISTANCE, ORBIT_MAX_DISTANCE, ORBIT_MAX_POLAR, MAX_PIXEL_RATIO,
    CAMERA_ZONES, SCENES,
} from './config.js';

// ── 角色系统 ──
import { createHumanoid, updateHumanoid, setHumanoidLookAt } from './character/humanoid.js';
import { initWalker, updateWalker, debugWalkLoop, teleport } from './character/walker.js';
import { buildNavGrid, rebuildDynamicObstacles } from './character/pathfinding.js';

// ── 外壳房子（岛屿 + GLB 模型）──
import { createHouseShell } from './elements/houseShell.js';

// ── 各系统 ──
import { initSeasons, updateSeason } from './systems/seasons.js';
import {
    initDoors, updateDoors, getDoors, pickDoorAt, setOnDoorToggle, setOnDoorTrigger,
    registerDoor, clearDoors,
} from './systems/doors.js';
import { createLighting } from './systems/lighting.js';
import { createTimeOfDay } from './systems/timeOfDay.js';
import {
    initCameraZones, updateCameraZones, getCameraZonesDebug,
    setCameraCollisionRoot, setZones,
} from './systems/cameraZones.js';
import {
    initSceneManager, registerSceneContainer, setInitialScene, switchTo,
} from './systems/sceneManager.js';
import { initDoorPrompt, updateDoorPrompt } from './systems/doorPrompt.js';
import { parseSurfaces } from './systems/surfaceParser.js';
import { applyToonShading } from './systems/toon.js';

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
let shotFramesLeft = Infinity;   // 截图模式：渲染 N 帧后停帧（?frames=N）

// ============================================================
//  岛屿地面 + 房子（加载完成后解析 surface → 导航网格 + 季节目标）
// ============================================================
let seasonValue = 0;   // 当前季节滑块值（模型加载完成后补刷）

/** 门开合时重建导航动态障碍（关着的门板是障碍） */
function refreshNavDoors() {
    const closed = getDoors()
        .filter(d => d.targetT < 0.5)
        .map(d => new THREE.Box3().setFromObject(d.obj));
    rebuildDynamicObstacles(closed);
}

const { group: houseShellGroup } = createHouseShell({
    onModelsReady: ({ walkable, obstacles, trees, flowerGroups, snowman, grassMaterials }) => {
        // 季节系统接管草地/树木/花卉/雪人
        initSeasons({ grassMaterials, trees, flowerGroups, snowman });
        updateSeason(seasonValue);
        // 模型驱动的导航网格（walkable/obstacle 表面）
        buildNavGrid({ walkable, obstacles });
        refreshNavDoors();
        // 相机墙体碰撞（target→相机射线，撞墙收缩）
        setCameraCollisionRoot(houseShellGroup);
        // 时段变色材质（室外窗玻璃 MAT_window_glass）
        timeOfDay.registerTintMaterials(houseShellGroup);
        // 截图调试：?scene= 直开指定场景
        if (pendingScene) {
            switchTo(pendingScene);
            pendingScene = null;
        }
        // 截图调试：往返走
        if (pendingWalkLoop) {
            debugWalkLoop(...pendingWalkLoop);
            pendingWalkLoop = null;
        }
    },
});
scene.add(houseShellGroup);

// ============================================================
//  季节系统（草地 + 树木/花果；具体目标在模型加载后注入）
// ============================================================
initSeasons();

// ============================================================
//  角色
// ============================================================
const humanoid = createHumanoid();
scene.add(humanoid);

// 门交互（必须在 initWalker 之前注册，点到门时阻止角色走动）
initDoors(camera, renderer);
setOnDoorToggle(refreshNavDoors);

// 角色点击走动
initWalker(humanoid, camera, renderer, scene);

// 相机区域系统（机位切换 + 跟随模式）
initCameraZones(camera, controls, renderer, humanoid);

// ============================================================
//  场景管理器（动森式独立场景切换：室外常驻，室内按需加载缓存）
// ============================================================
initSceneManager({
    scene,
    hooks: {
        // 室内场景按需加载：glb → 三渲二 → 隐藏 WALK_ → 返回容器
        // （门不在此注册——onActivated 统一 clearDoors + 重注册，保证状态恢复）
        loadScene: (def) => new Promise((resolve) => {
            new GLTFLoader().load(
                def.glbs[0],
                (gltf) => {
                    const group = new THREE.Group();
                    group.name = `scene:${def.id}`;
                    const model = gltf.scene;
                    applyToonShading(model);   // 三渲二：Standard → MeshToonMaterial
                    model.traverse((child) => {
                        if (!child.isMesh) return;
                        child.castShadow = true;
                        child.receiveShadow = true;
                        // WALK_ 面是逻辑行走面，不渲染（寻路系统用）
                        if (child.name.startsWith('WALK_')) {
                            child.visible = false;
                            child.castShadow = false;
                            child.receiveShadow = false;
                        }
                    });
                    group.add(model);
                    // 时段变色材质（室内窗景片 MAT_window_view）
                    timeOfDay.registerTintMaterials(group);
                    console.log(`[Main] 场景 ${def.id} 加载完成`);
                    resolve(group);
                },
                undefined,
                (err) => {
                    console.error(`[Main] 场景 ${def.id} 加载失败:`, err);
                    resolve(null);
                },
            );
        }),
        // 场景激活：重建导航/门/机位/相机碰撞/描边，角色落到 spawn
        onActivated: (def, group, spawnId) => {
            buildNavGrid(parseSurfaces(group));
            // 门换绑：清掉旧场景门（状态暂存 obj.userData），注册新场景门
            clearDoors();
            group.traverse((child) => {
                if (child.userData?.interactable_type === 'door') registerDoor(child);
            });
            refreshNavDoors();
            setZones(def.zones, def.categories);
            setCameraCollisionRoot(group);
            outline.selectedObjects = [group, humanoid];
            if (def.id === 'outdoor') updateSeason(seasonValue);
            // 光照换绑：室内关直射阳光/重摆窗光与顶灯，室外恢复默认
            timeOfDay.setSceneProfile(def.lighting ?? null);
            const spawn = def.spawns?.[spawnId ?? 'default'] ?? def.spawns?.default;
            if (spawn) teleport(spawn.pos[0], spawn.pos[1], spawn.pos[2], spawn.rotY ?? null);
        },
    },
});
registerSceneContainer('outdoor', houseShellGroup);
setInitialScene('outdoor');

// 门=传送点：点击带 door_target_scene 的门 → 切场景（开门动画照播）
setOnDoorTrigger((door) => switchTo(door.targetScene, door.targetSpawn ?? undefined));

// 走近传送门显示"按 E"气泡，按 E 切场景
initDoorPrompt({
    humanoid,
    camera,
    getLabel: (sceneId) => {
        const s = SCENES.find(sc => sc.id === sceneId);
        return s ? s.name : sceneId;
    },
    onTrigger: (door) => switchTo(door.targetScene, door.targetSpawn ?? undefined),
});

// ============================================================
//  灯光 + 时间系统
// ============================================================
const lighting = createLighting(scene);
const timeOfDay = createTimeOfDay(scene, lighting);
// 初始场景套用光照配置（内部按当前时段重算强度）；默认中午
timeOfDay.setSceneProfile(SCENES.find((s) => s.id === 'outdoor')?.lighting ?? null);
timeOfDay.update(2);

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

// 三渲二描边（房子/岛屿/角色）
const outline = new OutlinePass(
    new THREE.Vector2(innerWidth, innerHeight), scene, camera
);
outline.edgeStrength = OUTLINE_STRENGTH;
outline.edgeGlow = 0.0;
outline.edgeThickness = OUTLINE_THICKNESS;
outline.pulsePeriod = 0;
outline.visibleEdgeColor.set(OUTLINE_COLOR);
outline.hiddenEdgeColor.set(OUTLINE_COLOR);
outline.selectedObjects = [houseShellGroup, humanoid];
composer.addPass(outline);

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
    if (shotFramesLeft-- <= 0) return;   // 截图模式：停在最后一帧
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
    updateDoorPrompt();

    composer.render();
}
animate();

// 调试句柄（控制台/自动化测试用）：window.__app
window.__app = { scene, camera, controls, getDoors, pickDoorAt, humanoid, timeOfDay, lighting, camZones: getCameraZonesDebug(), switchTo, config: { SCENES } };

// ============================================================
//  截图调试模式（无头浏览器验收用，不影响正常交互）
//  ?cam=zoneId  立即切到机位   ?az=°&pol=°&dist=m  强制轨道位姿
//  ?time=0-5  时段            ?season=0-3  季节
//  ?scene=xxx  直开场景（模型就绪后切换）
//  ?lookat=x,y,z  强制轨道 target
//  ?walkloop=x1,z1,x2,z2  角色两点往返走（模型就绪后启动）
// ============================================================
let pendingWalkLoop = null;   // onModelsReady 后启动
let pendingScene = null;      // onModelsReady 后切换
{
    const q = new URLSearchParams(location.search);
    if (q.has('time')) timeOfDay.update(parseFloat(q.get('time')));
    if (q.has('season')) {
        seasonValue = parseFloat(q.get('season'));
        updateSeason(seasonValue);
    }
    if (q.has('cam')) {
        const z = CAMERA_ZONES.find(z => z.id === q.get('cam'));
        if (z) getCameraZonesDebug().goToZone(z, true);
    }
    if (q.has('scene')) {
        pendingScene = q.get('scene');
    }
    if (q.has('lookat')) {
        const [x, y, z] = q.get('lookat').split(',').map(Number);
        controls.target.set(x, y, z);
    }
    if (q.has('az') || q.has('pol') || q.has('dist')) {
        const az = THREE.MathUtils.degToRad(parseFloat(q.get('az') ?? '0'));
        const pol = THREE.MathUtils.degToRad(parseFloat(q.get('pol') ?? '70'));
        const d = parseFloat(q.get('dist') ?? '8');
        const t = controls.target;
        camera.position.set(
            t.x + d * Math.sin(pol) * Math.sin(az),
            t.y + d * Math.cos(pol),
            t.z + d * Math.sin(pol) * Math.cos(az),
        );
        controls.update();
    }
    if (q.has('walkloop')) {
        pendingWalkLoop = q.get('walkloop').split(',').map(Number);
    }
    if (q.has('frames')) {
        shotFramesLeft = parseInt(q.get('frames'), 10);
    }
}
