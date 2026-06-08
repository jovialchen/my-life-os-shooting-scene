/**
 * 主入口：场景初始化、组装、灯光、后期处理、动画循环
 *
 * 模块结构：
 *   js/config.js          — 全局常量
 *   js/materials.js       — 所有材质
 *   js/room/              — 房间壳体、窗户、装饰
 *   js/furniture/         — 沙发、椅子、茶几、边桌、落地灯、书架
 *   js/character/         — 人形角色
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }     from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass }     from 'three/addons/postprocessing/OutputPass.js';

import {
    ROOM_WIDTH, ROOM_HEIGHT, ROOM_DEPTH,
    BG_COLOR, FOG_NEAR, FOG_FAR,
    CAMERA_FOV, CAMERA_NEAR, CAMERA_FAR, CAMERA_POS, CAMERA_TARGET,
    TONE_MAPPING_EXPOSURE,
    BLOOM_STRENGTH, BLOOM_RADIUS, BLOOM_THRESHOLD
} from './config.js';

// ── 房间 ──
import { createRoom }       from './room/room.js';
import { createWindow, createCurtains, createPlant, createLightCone } from './room/window.js';
import { createRug, createWallArt } from './room/decorations.js';

// ── 家具 ──
import { createSofa }       from './furniture/sofa.js';
import { createChair }      from './furniture/chair.js';
import { createFloorLamp }  from './furniture/floorLamp.js';
import { createCoffeeTable } from './furniture/coffeeTable.js';
import { createSideTable }  from './furniture/sideTable.js';
import { createBookshelf }  from './furniture/bookshelf.js';

// ── 角色 ──
import { createHumanoid }   from './character/humanoid.js';

// ============================================================
//  场景 / 相机 / 渲染器
// ============================================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(BG_COLOR);
scene.fog = new THREE.Fog(BG_COLOR, FOG_NEAR, FOG_FAR);

const camera = new THREE.PerspectiveCamera(CAMERA_FOV, innerWidth / innerHeight, CAMERA_NEAR, CAMERA_FAR);
camera.position.set(CAMERA_POS.x, CAMERA_POS.y, CAMERA_POS.z);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
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
controls.dampingFactor = 0.05;
controls.minDistance = 2;
controls.maxDistance = 12;
controls.maxPolarAngle = Math.PI * 0.85;
controls.update();

// ============================================================
//  组装场景
// ============================================================

// 房间结构
scene.add(createRoom());
scene.add(createWindow());
scene.add(createCurtains());
scene.add(createPlant());
scene.add(createLightCone());

// 装饰
scene.add(createRug());
scene.add(createWallArt());

// 家具
scene.add(createSofa());
scene.add(createChair());
scene.add(createFloorLamp());
scene.add(createCoffeeTable());
scene.add(createSideTable());
scene.add(createBookshelf());

// 角色
scene.add(createHumanoid());

// ============================================================
//  灯光系统（暖色黄昏氛围）
// ============================================================

// 环境光 — 柔和暖色基底
scene.add(new THREE.AmbientLight(0xffeedd, 0.3));

// 主方向光 — 模拟夕阳从窗户照入
const sun = new THREE.DirectionalLight(0xffaa55, 1.8);
sun.position.set(5, 6, 2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left   = -6;
sun.shadow.camera.right  =  6;
sun.shadow.camera.top    =  5;
sun.shadow.camera.bottom = -5;
sun.shadow.camera.near   =  0.1;
sun.shadow.camera.far    = 20;
sun.shadow.radius = 6;
sun.shadow.bias = -0.0005;
scene.add(sun);

// 补光 — 另一侧冷色，增加层次
const fill = new THREE.DirectionalLight(0x8899bb, 0.3);
fill.position.set(-3, 4, -2);
scene.add(fill);

// 窗外聚光 — 暖光从窗户打入
const windowLight = new THREE.SpotLight(0xffcc88, 2.0, 10, Math.PI / 5, 0.5);
windowLight.position.set(ROOM_WIDTH / 2 + 0.5, 2.5, -0.5);
windowLight.target.position.set(0, 0, 0);
windowLight.castShadow = true;
windowLight.shadow.mapSize.set(1024, 1024);
scene.add(windowLight);
scene.add(windowLight.target);

// 落地灯点光源已在 createFloorLamp 中自动生成

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
    controls.update();
    composer.render();
}
animate();
