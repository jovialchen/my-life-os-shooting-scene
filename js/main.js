/**
 * 主入口：场景初始化、组装、灯光、后期处理、动画循环
 *
 * 架构：
 *   js/elements/    — 零件工厂（墙壁/家具/灯具/装饰/小物品）
 *   js/rooms/       — 房间配置文件
 *   js/elements/index.js — buildRoom 构建器
 *   js/config.js    — 全局常量
 *   js/materials.js — 材质
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
    CURTAIN_CLOSED_X, CURTAIN_OPEN_X, CURTAIN_SNAP_THRESH, CURTAIN_EASE_FACTOR,
    CURTAIN_ROD_HALF, CURTAIN_PLEAT_COMPRESSION, CURTAIN_PLEAT_FREQ_OX, CURTAIN_PLEAT_FREQ_T, CURTAIN_PLEAT_AMPLITUDE,
    TIME_PRESETS, SUN_ORBIT_RADIUS,
    CURTAIN_SUN_FACTOR, CURTAIN_SPOT_FACTOR, CURTAIN_FILL_FACTOR, CURTAIN_AMBIENT_BOOST,
    CLICK_DRAG_THRESHOLD,
    THUMB_SIZE, THUMB_AMBIENT_COLOR, THUMB_AMBIENT_INTENSITY,
    THUMB_LIGHT_COLOR, THUMB_LIGHT_INTENSITY, THUMB_LIGHT_POSITION,
    THUMB_CAMERA_FOV, THUMB_CAMERA_ASPECT, THUMB_CAMERA_NEAR, THUMB_CAMERA_FAR,
    THUMB_DIST_MULTIPLIER, THUMB_OFFSET_XZ, THUMB_OFFSET_Y,
} from './config.js';

// （房间配置和公寓系统已移除 — 使用 house.glb 模型替代）

// ── 角色 ──
import { createHumanoid, updateHumanoid, setHumanoidLookAt } from './character/humanoid.js';
import { initWalker, updateWalker, rebuildNavGrid } from './character/walker.js';
import { initApartmentGrid, rebuildGrid, setTreePositions } from './character/pathfinding.js';

// ── 交互 ──
import { createDragControls } from './interaction/dragControls.js';

// ── 外壳房子 ──
import { createHouseShell } from './elements/houseShell.js';

// ── 花卉 ──
import { createGardenFlowers } from './elements/flowers.js';

// ── 大树 ──
import { createGardenTrees, TREE_POSITIONS } from './elements/trees.js';

// ── 季节物体 ──
import { createSeasonalObjects } from './elements/seasonalObjects.js';

// ── 季节系统 ──
import { initSeasons, updateSeason } from './systems/seasons.js';

// ── 栅栏 ──
import { createFence } from './elements/fence.js';

// ── 墙体遮挡系统 ──
import { initWallOcclusion, updateWallOcclusion } from './systems/wallOcclusion.js';

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

// ═══ 公寓系统已移除（使用 house.glb 模型替代）═══





// ── 外壳房子（永远可见）──
const { group: houseShellGroup, door: shellDoor, grass, grassMesh } = createHouseShell();
scene.add(houseShellGroup);

// ── 花园花卉 ──
const gardenFlowers = createGardenFlowers(grass);
scene.add(gardenFlowers);

// ── 花园大树 ──
const gardenTrees = createGardenTrees(grass);
scene.add(gardenTrees);

// ── 季节物体（果子/蘑菇/雪人/雪团）──
const seasonalObjects = createSeasonalObjects(grass, gardenTrees);
scene.add(seasonalObjects);

// ── 草地栅栏 + 拱形门 ──
const fence = createFence(grass);
scene.add(fence);

// ── 初始化寻路网格（草地范围）──
setTreePositions(TREE_POSITIONS);
initApartmentGrid(null, null, grass);
rebuildGrid(null, null, null, null, grass);

// ── 初始化四季系统 ──
initSeasons(grassMesh, gardenTrees, gardenFlowers, seasonalObjects);
updateSeason(0); // 默认春天

// ── 房间系统已移除，以下引用全部为空 ──
let door = null;
let curtains = null;
let ceilingLight = null;
let floorLamp = null;
let allMovables = [];
let allSmallItems = [];
let furnitureList = [];

// 角色
const humanoid = createHumanoid();
scene.add(humanoid);

// 墙体遮挡透明系统（只处理 house GLB 模型和花园）
initWallOcclusion(null, camera, humanoid, houseShellGroup, [gardenTrees, gardenFlowers, seasonalObjects]);

// 侧边栏物品列表
let sidebarItems = [];

function rebuildSidebarItems() {
    sidebarItems.length = 0;
    // 房间系统已移除，没有家具/灯具/装饰可显示
}

// 初始构建侧边栏
rebuildSidebarItems();

// ============================================================
//  侧边栏：Tab 式面板（物品 / 人物 / 规则 / 语言）
// ============================================================
(function initSidebar() {
    const TEXTS = {
        zh: {
            tabs: ['物品', '人物', '规则'],
            time: '时间',
            timeNames: TIME_PRESETS.map(p => p.name),
            season: '季节',
            seasonNames: ['春', '夏', '秋', '冬'],
            rules: {
                title: '游戏规则',
                controls: '基本操作',
                controlsList: [
                    '拖拽旋转视角', '滚轮缩放', '右键平移视角',
                    '拖拽移动家具 / 角色', '点击窗帘 / 门 开合',
                    '点击灯具 开/关', '选中物体后 Q/E 旋转45°',
                    '选中书本后 R 垂直翻转',
                ],
                nav: '角色移动',
                navList: [
                    '点击地面，角色自动走向目标', '角色会绕开家具障碍物',
                    '门打开时角色会绕行门板', '移动书架/桌子时，上面的物品会一起带走',
                    '单独拖拽物品可从家具上拿下来',
                ],
                time: '时间系统',
                timeDesc: '拖动底部时间滑块可切换一天中的不同时段，灯光和天空颜色会随之变化。窗帘的开合也会影响室内光线。',
            },
            character: { title: '场景角色', name: '小人', desc: '点击地面让她走动，她会自动避开家具。可以拖拽移动她的位置。' },
            langLabel: '语言 / Language',
        },
        en: {
            tabs: ['Items', 'Cast', 'Rules'],
            time: 'Time',
            timeNames: TIME_PRESETS.map(p => p.nameEn || p.name),
            season: 'Season',
            seasonNames: ['Spring', 'Summer', 'Autumn', 'Winter'],
            rules: {
                title: 'Game Rules',
                controls: 'Basic Controls',
                controlsList: [
                    'Drag to rotate view', 'Scroll to zoom', 'Right-click to pan',
                    'Drag furniture / character to move', 'Click curtain / door to open/close',
                    'Click lights to toggle on/off', 'Q/E to rotate selected object 45°',
                    'R to flip book vertically',
                ],
                nav: 'Character Movement',
                navList: [
                    'Click on the floor to walk', 'Character avoids furniture obstacles',
                    'Character walks around open doors', 'Moving shelf/table carries items on top',
                    'Drag items off furniture to detach them',
                ],
                time: 'Time System',
                timeDesc: 'Drag the time slider at the bottom to switch between times of day. Lighting and sky colors change accordingly. Curtain state also affects indoor lighting.',
            },
            character: { title: 'Scene Characters', name: 'Character', desc: 'Click the floor to make her walk — she avoids furniture automatically. Drag to reposition.' },
            langLabel: '语言 / Language',
        },
    };

    let lang = localStorage.getItem('scene-lang') || 'zh';
    function t(key) {
        return key.split('.').reduce((o, k) => o && o[k], TEXTS[lang]) || key;
    }

    // ── 缩略图渲染器 ──
    const thumbRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    thumbRenderer.setSize(THUMB_SIZE, THUMB_SIZE);
    thumbRenderer.setPixelRatio(1);
    thumbRenderer.shadowMap.enabled = false;
    thumbRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    thumbRenderer.toneMappingExposure = TONE_MAPPING_EXPOSURE;
    const thumbScene = new THREE.Scene();
    thumbScene.background = new THREE.Color(BG_COLOR);
    thumbScene.add(new THREE.AmbientLight(THUMB_AMBIENT_COLOR, THUMB_AMBIENT_INTENSITY));
    const thumbLight = new THREE.DirectionalLight(THUMB_LIGHT_COLOR, THUMB_LIGHT_INTENSITY);
    thumbLight.position.set(THUMB_LIGHT_POSITION.x, THUMB_LIGHT_POSITION.y, THUMB_LIGHT_POSITION.z);
    thumbScene.add(thumbLight);
    const thumbCam = new THREE.PerspectiveCamera(THUMB_CAMERA_FOV, THUMB_CAMERA_ASPECT, THUMB_CAMERA_NEAR, THUMB_CAMERA_FAR);

    function renderThumbnail(obj) {
        const box = new THREE.Box3().setFromObject(obj);
        if (!isFinite(box.min.x) || !isFinite(box.max.x)) {
            const fallback = document.createElement('canvas');
            fallback.width = fallback.height = THUMB_SIZE;
            return fallback.toDataURL();
        }
        const center = new THREE.Vector3();
        const size = new THREE.Vector3();
        box.getCenter(center);
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        const dist = maxDim * THUMB_DIST_MULTIPLIER;
        thumbCam.position.set(
            center.x + dist * THUMB_OFFSET_XZ,
            center.y + dist * THUMB_OFFSET_Y,
            center.z + dist * THUMB_OFFSET_XZ,
        );
        thumbCam.lookAt(center);
        thumbCam.updateProjectionMatrix();
        const parent = obj.parent;
        if (parent) parent.remove(obj);
        thumbScene.add(obj);
        thumbRenderer.render(thumbScene, thumbCam);
        const url = thumbRenderer.domElement.toDataURL();
        thumbScene.remove(obj);
        if (parent) parent.add(obj);
        return url;
    }

    // ── 渲染物品面板 ──
    const itemsPanel = document.querySelector('[data-panel="items"]');
    const categories = [
        { zh: '家具', en: 'Furniture' },
        { zh: '灯具', en: 'Lighting' },
        { zh: '挂画', en: 'Wall Art' },
        { zh: '小物品', en: 'Small Items' },
        { zh: '窗帘', en: 'Curtains' },
        { zh: '地毯', en: 'Rug' },
    ];

    function renderItems() {
        itemsPanel.innerHTML = '';
        categories.forEach(cat => {
            const catItems = sidebarItems.filter(i => i.cat === cat.zh);
            if (catItems.length === 0) return;
            const title = document.createElement('div');
            title.className = 'sb-title';
            title.textContent = `${lang === 'zh' ? cat.zh : cat.en}（${catItems.length}）`;
            itemsPanel.appendChild(title);
            catItems.forEach(item => {
                const div = document.createElement('div');
                div.className = 'sb-item';
                const thumb = document.createElement('div');
                thumb.className = 'sb-thumb';
                const img = document.createElement('img');
                img.src = renderThumbnail(item.obj);
                img.style.cssText = 'width:100%;height:100%;object-fit:contain;';
                thumb.appendChild(img);
                const info = document.createElement('div');
                info.className = 'sb-info';
                const itemName = lang === 'zh' ? item.name : item.nameEn;
                const itemCat  = lang === 'zh' ? item.cat  : item.catEn;
                info.innerHTML = `<div class="sb-name">${itemName}</div><div class="sb-meta">${itemCat}</div>`;
                div.appendChild(thumb);
                div.appendChild(info);
                itemsPanel.appendChild(div);
            });
        });
    }
    renderItems();

    // ── 渲染人物面板 ──
    const charPanel = document.querySelector('[data-panel="characters"]');
    function renderCharacters() {
        charPanel.innerHTML = '';
        const card = document.createElement('div');
        card.className = 'char-card';
        const thumb = document.createElement('div');
        thumb.className = 'sb-thumb';
        const img = document.createElement('img');
        img.src = renderThumbnail(humanoid);
        img.style.cssText = 'width:100%;height:100%;object-fit:contain;';
        thumb.appendChild(img);
        const info = document.createElement('div');
        info.className = 'sb-info';
        info.innerHTML = `<div class="char-name">${t('character.name')}</div><div class="char-desc">${t('character.desc')}</div>`;
        card.appendChild(thumb);
        card.appendChild(info);
        charPanel.appendChild(card);
    }
    renderCharacters();

    // ── 渲染规则面板 ──
    const rulesPanel = document.querySelector('[data-panel="rules"]');
    function renderRules() {
        rulesPanel.innerHTML = '';
        const r = TEXTS[lang].rules;
        const secControls = document.createElement('div');
        secControls.className = 'rules-section';
        secControls.innerHTML = `<h3>${r.controls}</h3><ul>${r.controlsList.map(i => `<li>${i}</li>`).join('')}</ul>`;
        rulesPanel.appendChild(secControls);
        const secNav = document.createElement('div');
        secNav.className = 'rules-section';
        secNav.innerHTML = `<h3>${r.nav}</h3><ul>${r.navList.map(i => `<li>${i}</li>`).join('')}</ul>`;
        rulesPanel.appendChild(secNav);
        const secTime = document.createElement('div');
        secTime.className = 'rules-section';
        secTime.innerHTML = `<h3>${r.time}</h3><p>${r.timeDesc}</p>`;
        rulesPanel.appendChild(secTime);
    }
    renderRules();

    // ── 语言切换球 ──
    const langGlobe = document.getElementById('lang-globe');
    function updateGlobeOpts() {
        langGlobe.querySelectorAll('.lang-opt').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === lang);
        });
    }
    langGlobe.addEventListener('click', (e) => {
        const opt = e.target.closest('.lang-opt');
        if (opt) {
            const code = opt.dataset.lang;
            if (lang !== code) {
                lang = code;
                localStorage.setItem('scene-lang', lang);
                refreshAll();
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

    function refreshAll() {
        document.querySelectorAll('.sb-tab').forEach((tab, i) => {
            tab.textContent = TEXTS[lang].tabs[i];
        });
        const timeBarLabel = document.querySelector('#time-bar label');
        if (timeBarLabel) timeBarLabel.textContent = `☀ ${t('time')}`;
        const slider = document.getElementById('time-slider');
        const timeLabelEl = document.getElementById('time-label');
        if (slider && timeLabelEl) {
            timeLabelEl.textContent = t('timeNames')[Math.round(parseFloat(slider.value))] || '';
        }
        // 季节标签
        const seasonBarLabel = document.querySelector('#season-bar label');
        if (seasonBarLabel) seasonBarLabel.textContent = `🍃 ${t('season')}`;
        const seasonSliderEl = document.getElementById('season-slider');
        const seasonLabelEl = document.getElementById('season-label');
        if (seasonSliderEl && seasonLabelEl) {
            seasonLabelEl.textContent = t('seasonNames')[Math.round(parseFloat(seasonSliderEl.value))] || '';
        }
        renderItems();
        renderCharacters();
        renderRules();
        updateGlobeOpts();
    }

    document.querySelectorAll('.sb-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.sb-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.sb-panel').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            const panel = document.querySelector(`[data-panel="${tab.dataset.tab}"]`);
            if (panel) panel.classList.add('active');
        });
    });

    const sidebar = document.getElementById('sidebar');
    const toggle  = document.getElementById('sb-toggle');
    if (toggle && sidebar) {
        toggle.addEventListener('click', () => {
            sidebar.classList.toggle('closed');
            toggle.textContent = sidebar.classList.contains('closed') ? '▶' : '◀';
        });
    }

    window._sidebarRefresh = refreshAll;
    window._sidebarLang = () => lang;
})();

// ============================================================
//  拖拽交互
// ============================================================
const dragControlsInstance = createDragControls([humanoid], camera, renderer, controls, scene, {
    onDrop: rebuildNavGrid,
    apartment: null,
});

// ============================================================
//  角色点击走动
// ============================================================
initWalker(humanoid, camera, renderer, scene, null, null, grass);

// 点击检测（区分点击与拖拽）
const clickRaycaster = new THREE.Raycaster();
const clickMouse = new THREE.Vector2();
let pointerDownPos = null;

renderer.domElement.addEventListener('pointerdown', e => {
    pointerDownPos = { x: e.clientX, y: e.clientY };
});

renderer.domElement.addEventListener('pointerup', e => {
    if (!pointerDownPos) return;
    const dx = e.clientX - pointerDownPos.x;
    const dy = e.clientY - pointerDownPos.y;
    pointerDownPos = null;
    if (Math.sqrt(dx * dx + dy * dy) > CLICK_DRAG_THRESHOLD) return;

    clickMouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    clickMouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    clickRaycaster.setFromCamera(clickMouse, camera);

    // 房间系统已移除，窗帘/门/灯具点击交互不再需要
});

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
// room-f 中心在 (-4, 0)，南墙在 z = -3.5
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

updateTimeOfDay(2);

const timeSlider = document.getElementById('time-slider');
const timeLabel  = document.getElementById('time-label');
if (timeSlider) {
    timeSlider.addEventListener('input', () => {
        const v = parseFloat(timeSlider.value);
        updateTimeOfDay(v);
        const preset = TIME_PRESETS[Math.round(v)];
        if (timeLabel) timeLabel.textContent = (window._sidebarLang && window._sidebarLang() === 'en') ? preset.nameEn : preset.name;
    });
}

// ── 季节滑块 ──
const SEASON_PRESETS_REF = [
    { name: '春', nameEn: 'Spring' },
    { name: '夏', nameEn: 'Summer' },
    { name: '秋', nameEn: 'Autumn' },
    { name: '冬', nameEn: 'Winter' },
];
const seasonSlider = document.getElementById('season-slider');
const seasonLabel  = document.getElementById('season-label');
if (seasonSlider) {
    seasonSlider.addEventListener('input', () => {
        const v = parseFloat(seasonSlider.value);
        updateSeason(v);
        const preset = SEASON_PRESETS_REF[Math.round(v)];
        if (seasonLabel) seasonLabel.textContent = (window._sidebarLang && window._sidebarLang() === 'en') ? preset.nameEn : preset.name;
    });
}

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

    if (compassRing) {
        const camAngle = Math.atan2(
            controls.target.x - camera.position.x,
            controls.target.z - camera.position.z,
        );
        compassRing.style.transform = `rotate(${camAngle * 180 / Math.PI}deg)`;
    }

    if (!lookAtBound && humanoid.userData.vrm) {
        setHumanoidLookAt(camera);
        lookAtBound = true;
    }

    updateHumanoid(delta);
    updateWalker(delta);

    // 门动画 / 窗帘动画已移除（房间系统已不再使用）

    // 墙体遮挡透明
    updateWallOcclusion(delta);

    composer.render();
}
animate();
