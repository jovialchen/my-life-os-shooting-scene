/**
 * 主入口：场景初始化、灯光、后期处理、动画循环
 *
 * 场景组成：
 *   - 绿色草地（CircleGeometry）
 *   - GLB 房子模型（models/house.glb）
 *   - VRM 人物（models/hazel-pink.vrm）
 *   - 相机（OrbitControls + 角色跟随）
 *   - 灯光系统（环境光 + 太阳方向光 + 补光 + 窗光）
 *   - 时间系统（6 时段平滑过渡）
 *   - 季节系统（草地颜色变化）
 *   - 指南针
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
    CAMERA_FOLLOW_SPEED, CAMERA_FOLLOW_Y,
    AMBIENT_LIGHT_COLOR, AMBIENT_LIGHT_INTENSITY,
    SUN_COLOR, SUN_INTENSITY, SUN_POSITION,
    SUN_SHADOW_MAP_SIZE, SUN_SHADOW_LEFT, SUN_SHADOW_RIGHT, SUN_SHADOW_TOP, SUN_SHADOW_BOTTOM,
    SUN_SHADOW_NEAR, SUN_SHADOW_FAR, SUN_SHADOW_RADIUS, SUN_SHADOW_BIAS,
    FILL_LIGHT_COLOR, FILL_LIGHT_INTENSITY, FILL_LIGHT_POSITION,
    WINDOW_SPOT_COLOR, WINDOW_SPOT_INTENSITY, WINDOW_SPOT_DISTANCE, WINDOW_SPOT_ANGLE, WINDOW_SPOT_PENUMBRA,
    WINDOW_SPOT_POSITION,
    TIME_PRESETS, SUN_ORBIT_RADIUS,
} from './config.js';

// ── 角色系统 ──
import { createHumanoid, updateHumanoid, setHumanoidLookAt } from './character/humanoid.js';
import { initWalker, updateWalker } from './character/walker.js';
import { initApartmentGrid, rebuildGrid } from './character/pathfinding.js';

// ── 外壳房子（草地 + GLB 模型）──
import { createHouseShell } from './elements/houseShell.js';

// ── 季节系统（仅草地颜色）──
import { initSeasons, updateSeason } from './systems/seasons.js';

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
const _followTarget = new THREE.Vector3();
let lookAtBound = false;

// ============================================================
//  草地 + 房子
// ============================================================
const { group: houseShellGroup, grass, grassMesh } = createHouseShell();
scene.add(houseShellGroup);

// ============================================================
//  寻路网格（仅草地范围，无树木障碍）
// ============================================================
initApartmentGrid(null, null, grass);
rebuildGrid(null, null, null, null, grass);

// ============================================================
//  季节系统（仅草地颜色）
// ============================================================
initSeasons(grassMesh);
updateSeason(0); // 默认春天

// ============================================================
//  角色
// ============================================================
const humanoid = createHumanoid();
scene.add(humanoid);

// 角色点击走动
initWalker(humanoid, camera, renderer, scene, null, null, grass);

// ============================================================
//  灯光系统
// ============================================================

const ambientLight = new THREE.AmbientLight(AMBIENT_LIGHT_COLOR, AMBIENT_LIGHT_INTENSITY);
scene.add(ambientLight);

const sun = new THREE.DirectionalLight(SUN_COLOR, SUN_INTENSITY);
sun.position.set(SUN_POSITION.x, SUN_POSITION.y, SUN_POSITION.z);
sun.castShadow = true;
sun.shadow.mapSize.set(SUN_SHADOW_MAP_SIZE, SUN_SHADOW_MAP_SIZE);
sun.shadow.camera.left   = SUN_SHADOW_LEFT;
sun.shadow.camera.right  = SUN_SHADOW_RIGHT;
sun.shadow.camera.top    = SUN_SHADOW_TOP;
sun.shadow.camera.bottom = SUN_SHADOW_BOTTOM;
sun.shadow.camera.near   = SUN_SHADOW_NEAR;
sun.shadow.camera.far    = SUN_SHADOW_FAR;
sun.shadow.radius = SUN_SHADOW_RADIUS;
sun.shadow.bias = SUN_SHADOW_BIAS;
scene.add(sun);

const fill = new THREE.DirectionalLight(FILL_LIGHT_COLOR, FILL_LIGHT_INTENSITY);
fill.position.set(FILL_LIGHT_POSITION.x, FILL_LIGHT_POSITION.y, FILL_LIGHT_POSITION.z);
scene.add(fill);

const windowLight = new THREE.SpotLight(
    WINDOW_SPOT_COLOR, WINDOW_SPOT_INTENSITY, WINDOW_SPOT_DISTANCE,
    WINDOW_SPOT_ANGLE, WINDOW_SPOT_PENUMBRA,
);
windowLight.position.set(-4 + WINDOW_SPOT_POSITION.x, WINDOW_SPOT_POSITION.y, -3.5 - 0.5);
windowLight.target.position.set(-4, 0, 0);
windowLight.castShadow = false;
scene.add(windowLight);
scene.add(windowLight.target);

// ============================================================
//  一天时间系统
// ============================================================

function smoothstep(t) { return t * t * (3 - 2 * t); }
function lerp(a, b, t) { return a + (b - a) * t; }
function lerpHSL(h1, s1, l1, h2, s2, l2, t) {
    let dh = h2 - h1;
    if (dh > 0.5) dh -= 1;
    if (dh < -0.5) dh += 1;
    return { h: (h1 + dh * t + 1) % 1, s: lerp(s1, s2, t), l: lerp(l1, l2, t) };
}

let sunBaseIntensity     = SUN_INTENSITY;
let ambientBaseIntensity = AMBIENT_LIGHT_INTENSITY;
let fillBaseIntensity    = FILL_LIGHT_INTENSITY;
let spotBaseIntensity    = WINDOW_SPOT_INTENSITY;

function updateTimeOfDay(value) {
    const idx = Math.min(Math.floor(value), TIME_PRESETS.length - 2);
    const t = smoothstep(value - idx);
    const a = TIME_PRESETS[idx];
    const b = TIME_PRESETS[idx + 1];

    const az = lerp(a.az, b.az, t) * Math.PI / 180;
    const el = lerp(a.el, b.el, t) * Math.PI / 180;
    sun.position.set(
        -SUN_ORBIT_RADIUS * Math.cos(el) * Math.sin(az),
        SUN_ORBIT_RADIUS * Math.sin(el),
        SUN_ORBIT_RADIUS * Math.cos(el) * Math.cos(az),
    );

    const hsl = lerpHSL(a.h, a.s, a.l, b.h, b.s, b.l, t);
    sun.color.setHSL(hsl.h, hsl.s, hsl.l);

    sunBaseIntensity     = lerp(a.sun,     b.sun,     t);
    ambientBaseIntensity = lerp(a.ambient, b.ambient, t);
    fillBaseIntensity    = lerp(a.fill,    b.fill,    t);
    spotBaseIntensity    = lerp(a.spot,    b.spot,    t);

    const bgColor = new THREE.Color(a.bg).lerp(new THREE.Color(b.bg), t);
    scene.background = bgColor;
}

updateTimeOfDay(2); // 默认中午

// ============================================================
//  时间 + 季节滑块
// ============================================================
const timeSlider = document.getElementById('time-slider');
const timeLabel  = document.getElementById('time-label');

const SEASON_NAMES = { zh: ['春', '夏', '秋', '冬'], en: ['Spring', 'Summer', 'Autumn', 'Winter'] };

function currentLang() {
    return localStorage.getItem('scene-lang') || 'zh';
}

if (timeSlider) {
    timeSlider.addEventListener('input', () => {
        const v = parseFloat(timeSlider.value);
        updateTimeOfDay(v);
        const preset = TIME_PRESETS[Math.round(v)];
        if (timeLabel) timeLabel.textContent = currentLang() === 'en' ? preset.nameEn : preset.name;
    });
}

const seasonSlider = document.getElementById('season-slider');
const seasonLabel  = document.getElementById('season-label');
if (seasonSlider) {
    seasonSlider.addEventListener('input', () => {
        const v = parseFloat(seasonSlider.value);
        updateSeason(v);
        const idx = Math.round(v);
        if (seasonLabel) seasonLabel.textContent = SEASON_NAMES[currentLang()][idx];
    });
}

// ============================================================
//  语言切换
// ============================================================
(function initLanguageToggle() {
    const langGlobe = document.getElementById('lang-globe');
    if (!langGlobe) return;

    function updateGlobeOpts() {
        langGlobe.querySelectorAll('.lang-opt').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === currentLang());
        });
    }

    langGlobe.addEventListener('click', (e) => {
        const opt = e.target.closest('.lang-opt');
        if (opt) {
            const code = opt.dataset.lang;
            if (currentLang() !== code) {
                localStorage.setItem('scene-lang', code);
                updateGlobeOpts();
                // 刷新时间 & 季节标签
                if (timeSlider) {
                    const v = parseFloat(timeSlider.value);
                    const preset = TIME_PRESETS[Math.round(v)];
                    if (timeLabel) timeLabel.textContent = code === 'en' ? preset.nameEn : preset.name;
                }
                if (seasonSlider) {
                    const idx = Math.round(parseFloat(seasonSlider.value));
                    if (seasonLabel) seasonLabel.textContent = SEASON_NAMES[code][idx];
                }
                // 刷新时间栏 label
                const timeBarLabel = document.querySelector('#time-bar label');
                if (timeBarLabel) timeBarLabel.textContent = code === 'en' ? '☀ Time' : '☀ 时间';
                // 刷新季节栏 label
                const seasonBarLabel = document.querySelector('#season-bar label');
                if (seasonBarLabel) seasonBarLabel.textContent = code === 'en' ? '🍃 Season' : '🍃 季节';
            }
            langGlobe.classList.remove('open');
            return;
        }
        langGlobe.classList.toggle('open');
    });
    document.addEventListener('click', (e) => {
        if (!langGlobe.contains(e.target)) langGlobe.classList.remove('open');
    });
    updateGlobeOpts();
})();

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
//  指南针
// ============================================================
const compassRing = document.getElementById('compass-ring');

// ============================================================
//  动画循环
// ============================================================
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    controls.update();

    // 相机跟随角色
    if (humanoid.userData.vrm) {
        const t = 1 - Math.exp(-CAMERA_FOLLOW_SPEED * delta);
        _followTarget.set(humanoid.position.x, CAMERA_FOLLOW_Y, humanoid.position.z);
        controls.target.lerp(_followTarget, t);
    }

    // 指南针旋转
    if (compassRing) {
        const camAngle = Math.atan2(
            controls.target.x - camera.position.x,
            controls.target.z - camera.position.z,
        );
        compassRing.style.transform = `rotate(${camAngle * 180 / Math.PI}deg)`;
    }

    // 角色头部追踪相机（首次绑定）
    if (!lookAtBound && humanoid.userData.vrm) {
        setHumanoidLookAt(camera);
        lookAtBound = true;
    }

    updateHumanoid(delta);
    updateWalker(delta);

    // 灯光强度随一天时间变化
    sun.intensity     = sunBaseIntensity;
    ambientLight.intensity = ambientBaseIntensity;
    fill.intensity    = fillBaseIntensity;
    windowLight.intensity = spotBaseIntensity;

    composer.render();
}
animate();
