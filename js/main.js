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
    BG_COLOR, FOG_NEAR, FOG_FAR,
    CAMERA_FOV, CAMERA_NEAR, CAMERA_FAR, CAMERA_POS, CAMERA_TARGET,
    TONE_MAPPING_EXPOSURE,
    BLOOM_STRENGTH, BLOOM_RADIUS, BLOOM_THRESHOLD,
    ORBIT_DAMPING, ORBIT_MIN_DISTANCE, ORBIT_MAX_DISTANCE, ORBIT_MAX_POLAR, MAX_PIXEL_RATIO,
    AMBIENT_LIGHT_COLOR, AMBIENT_LIGHT_INTENSITY,
    SUN_COLOR, SUN_INTENSITY, SUN_POSITION,
    SUN_SHADOW_MAP_SIZE, SUN_SHADOW_LEFT, SUN_SHADOW_RIGHT, SUN_SHADOW_TOP, SUN_SHADOW_BOTTOM,
    SUN_SHADOW_NEAR, SUN_SHADOW_FAR, SUN_SHADOW_RADIUS, SUN_SHADOW_BIAS,
    FILL_LIGHT_COLOR, FILL_LIGHT_INTENSITY, FILL_LIGHT_POSITION,
    WINDOW_SPOT_COLOR, WINDOW_SPOT_INTENSITY, WINDOW_SPOT_DISTANCE, WINDOW_SPOT_ANGLE, WINDOW_SPOT_PENUMBRA,
    WINDOW_SPOT_POSITION, WINDOW_SPOT_SHADOW_MAP_SIZE,
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

// ── 零件库 + 房间配置 ──
import { buildRoom } from './elements/index.js';
import { livingRoom } from './rooms/living-room.js';
import { centralHall } from './rooms/central-hall.js';
import { bedroom1, bedroom2, bedroom3, masterBedroom } from './rooms/bedroom.js';

// ── 公寓系统 ──
import { Apartment } from './apartment.js';

// ── 角色 ──
import { createHumanoid, updateHumanoid, setHumanoidLookAt } from './character/humanoid.js';
import { initWalker, updateWalker, rebuildNavGrid } from './character/walker.js';

// ── 交互 ──
import { createDragControls } from './interaction/dragControls.js';

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
//  构建公寓（多房间系统）
// ============================================================
const apartment = new Apartment();

// 注册所有房间
apartment.addRoom('living-room', livingRoom, { x: 0, z: 0 });
apartment.addRoom('central-hall', centralHall, { x: 0, z: 5 });
apartment.addRoom('bedroom-1', bedroom1, { x: -4.9, z: 8.5 });
apartment.addRoom('bedroom-2', bedroom2, { x: -2.1, z: 8.5 });
apartment.addRoom('bedroom-3', bedroom3, { x: 2.25, z: 8.5 });
apartment.addRoom('master-bedroom', masterBedroom, { x: 5.0, z: 8.5 });

// 建立房间连接
apartment.addConnection('living-room', 'central-hall', { x: 0, z: 3.5 });
apartment.addConnection('central-hall', 'bedroom-1', { x: -4.9, z: 6.5 });
apartment.addConnection('central-hall', 'bedroom-2', { x: -2.1, z: 6.5 });
apartment.addConnection('central-hall', 'bedroom-3', { x: 2.25, z: 6.5 });
apartment.addConnection('central-hall', 'master-bedroom', { x: 5.0, z: 6.5 });

// 构建并显示客厅
apartment.build(scene, 'living-room');

// ── 当前房间的可变引用 ──
let currentRoomResult = apartment.getCurrentRoom().result;
let door         = currentRoomResult.door;
let curtains     = currentRoomResult.curtains;
let ceilingLight = currentRoomResult.ceilingLight;
let floorLamp    = currentRoomResult.floorLamp;
let allMovables  = currentRoomResult.allMovables;
let allSmallItems = currentRoomResult.smallItems;
let furnitureList = currentRoomResult.furniture;

// ── 房间切换回调 ──
apartment.onRoomSwitch = (newRoomId, oldRoomId, entryPos) => {
    const newRoom = apartment.getCurrentRoom();
    currentRoomResult = newRoom.result;
    door         = currentRoomResult.door;
    curtains     = currentRoomResult.curtains;
    ceilingLight = currentRoomResult.ceilingLight;
    floorLamp    = currentRoomResult.floorLamp;
    allMovables  = currentRoomResult.allMovables;
    allSmallItems = currentRoomResult.smallItems;
    furnitureList = currentRoomResult.furniture;

    // 更新灯具状态
    const newCeilingBulb = ceilingLight?.userData.lightRef;
    const newFloorLampBulb = floorLamp?.userData.lightRef;
    if (ceilingLight && newCeilingBulb) {
        newCeilingBulb.userData.on = true;
        newCeilingBulb.userData.baseIntensity = newCeilingBulb.intensity;
    }
    if (floorLamp && newFloorLampBulb) {
        newFloorLampBulb.userData.on = true;
        newFloorLampBulb.userData.baseIntensity = newFloorLampBulb.intensity;
    }

    // 传送角色到新房间门口
    if (entryPos) {
        humanoid.position.x = entryPos.x;
        humanoid.position.z = entryPos.z;
        console.log(`[Room Switch] 传送到: x=${entryPos.x.toFixed(2)}, z=${entryPos.z.toFixed(2)}`);
    }

    // 重建寻路网格并继续走向目标
    rebuildNavGrid();

    // 更新拖拽控制器的可移动物体列表
    if (dragControlsInstance) {
        dragControlsInstance.updateMovables([...allMovables, humanoid]);
    }

    // 重建窗帘面板引用
    rebuildCurtainPanels();

    // 重建侧边栏物品列表
    rebuildSidebarItems();

    // 刷新侧边栏 UI
    if (window._sidebarRefresh) window._sidebarRefresh();

    console.log(`[Room Switch] ${oldRoomId} → ${newRoomId}`);
};

// 角色
const humanoid = createHumanoid();
scene.add(humanoid);

// 从家具列表中提取引用（用于侧边栏和障碍物）
const sofa        = furnitureList.find(f => f.type === 'sofa')?.group;
const chair       = furnitureList.find(f => f.type === 'chair')?.group;
const coffeeTable = furnitureList.find(f => f.type === 'coffeeTable')?.group;
const sideTable   = furnitureList.find(f => f.type === 'sideTable')?.group;
const bookshelf   = furnitureList.find(f => f.type === 'bookshelf')?.group;
const ceilingBulb = ceilingLight?.userData.lightRef;
const floorLampBulb = floorLamp?.userData.lightRef;

// 灯具标记（buildRoom 已设置 toggleType/notMovable，这里补充 lightRef）
if (ceilingLight && ceilingBulb) {
    ceilingBulb.userData.on = true;
    ceilingBulb.userData.baseIntensity = ceilingBulb.intensity;
}
if (floorLamp && floorLampBulb) {
    floorLampBulb.userData.on = true;
    floorLampBulb.userData.baseIntensity = floorLampBulb.intensity;
}

// 侧边栏物品列表
let sidebarItems = [];

function rebuildSidebarItems() {
    sidebarItems.length = 0;

    // 从当前房间提取家具引用
    const curFurniture = furnitureList;
    const curSofa        = curFurniture.find(f => f.type === 'sofa')?.group;
    const curChair       = curFurniture.find(f => f.type === 'chair')?.group;
    const curCoffeeTable = curFurniture.find(f => f.type === 'coffeeTable')?.group;
    const curSideTable   = curFurniture.find(f => f.type === 'sideTable')?.group;
    const curBookshelf   = curFurniture.find(f => f.type === 'bookshelf')?.group;
    const curFloorLamp   = floorLamp;
    const curCeilingLight = ceilingLight;
    const curCurtains    = curtains;

    if (curSofa)        sidebarItems.push({ obj: curSofa,        name: '三人沙发',   nameEn: 'Sofa',            cat: '家具',   catEn: 'Furniture' });
    if (curChair)       sidebarItems.push({ obj: curChair,       name: '单人椅',     nameEn: 'Chair',           cat: '家具',   catEn: 'Furniture' });
    if (curCoffeeTable) sidebarItems.push({ obj: curCoffeeTable, name: '圆形茶几',   nameEn: 'Coffee Table',    cat: '家具',   catEn: 'Furniture' });
    if (curSideTable)   sidebarItems.push({ obj: curSideTable,   name: '圆形边桌',   nameEn: 'Side Table',      cat: '家具',   catEn: 'Furniture' });
    if (curFloorLamp)   sidebarItems.push({ obj: curFloorLamp,   name: '落地灯',     nameEn: 'Floor Lamp',      cat: '家具',   catEn: 'Furniture' });
    if (curCeilingLight) sidebarItems.push({ obj: curCeilingLight, name: '顶灯',     nameEn: 'Ceiling Light',   cat: '灯具',   catEn: 'Lighting' });
    if (curBookshelf)   sidebarItems.push({ obj: curBookshelf,   name: '三层书架',   nameEn: 'Bookshelf',       cat: '家具',   catEn: 'Furniture' });

    // 添加装饰和小物品到侧边栏
    const roomGroup = apartment.getCurrentRoom()?.result?.group;
    if (roomGroup) {
        const rug = roomGroup.children.find(c => c.userData?.noCollision);
        const wallArt = roomGroup.children.find(c => c.userData?.crossWall);
        if (wallArt) sidebarItems.push({ obj: wallArt, name: '装饰画', nameEn: 'Wall Art', cat: '挂画', catEn: 'Wall Art' });
        if (curCurtains) sidebarItems.push({ obj: curCurtains, name: '窗帘', nameEn: 'Curtains', cat: '窗帘', catEn: 'Curtains' });
        if (rug) sidebarItems.push({ obj: rug, name: '地毯', nameEn: 'Rug', cat: '地毯', catEn: 'Rug' });
    }

    // 小物品
    allSmallItems.forEach((item, i) => {
        const type = item.userData.rotationConstraint === 'any' ? 'book' : (item.children?.length > 1 ? 'plant' : 'cushion');
        const names = { book: `书本 ${i + 1}`, plant: '窗台盆栽', cushion: '靠枕' };
        const namesEn = { book: `Book ${i + 1}`, plant: 'Window Plant', cushion: 'Cushion' };
        sidebarItems.push({ obj: item, name: names[type] || '小物品', nameEn: namesEn[type] || 'Item', cat: '小物品', catEn: 'Small Items' });
    });

    // 门
    if (door) sidebarItems.push({ obj: door, name: '门', nameEn: 'Door', cat: '家具', catEn: 'Furniture' });
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
const dragControlsInstance = createDragControls([...allMovables, humanoid], camera, renderer, controls, scene, {
    onDrop: rebuildNavGrid,
    apartment: apartment,
});

// ============================================================
//  角色点击走动
// ============================================================
const furnitureObstacles = [sofa, chair, coffeeTable, sideTable, bookshelf, floorLamp].filter(Boolean);
initWalker(humanoid, camera, renderer, scene, furnitureObstacles, door, apartment);

// ============================================================
//  窗帘点击开合
// ============================================================
let curtainPanels = [];
let curtainOpen = true;
let curtainTargetX = CURTAIN_OPEN_X;

function rebuildCurtainPanels() {
    curtainPanels = [];
    if (curtains) {
        curtains.children.forEach(child => {
            if (child.isMesh && child.geometry.type === 'PlaneGeometry') {
                curtainPanels.push(child);
            }
        });
    }
    // 初始窗帘打开
    curtainPanels.forEach(panel => {
        panel.position.x = panel.userData.side * CURTAIN_OPEN_X;
    });
}
rebuildCurtainPanels();

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

    // 窗帘点击
    if (curtainPanels.length > 0) {
        const hits = clickRaycaster.intersectObjects(curtainPanels, false);
        if (hits.length > 0) {
            curtainOpen = !curtainOpen;
            curtainTargetX = curtainOpen ? CURTAIN_OPEN_X : CURTAIN_CLOSED_X;
        }
    }

    // 门点击
    if (door) {
        const doorHits = clickRaycaster.intersectObjects(door.children, true);
        if (doorHits.length > 0) {
            door.userData.isOpen = !door.userData.isOpen;
            door.userData.targetRotation = door.userData.isOpen ? Math.PI / 2 : 0;
            // 更新房间可见性（门打开时显示相邻房间）
            apartment.updateVisibility();
        }
    }

    // 灯具点击开关
    const lightTargets = [ceilingLight, floorLamp].filter(Boolean);
    if (lightTargets.length > 0) {
        const lightHits = clickRaycaster.intersectObjects(lightTargets, true);
        if (lightHits.length > 0) {
            let obj = lightHits[0].object;
            while (obj && obj.userData.toggleType !== 'light') obj = obj.parent;
            if (obj) {
                const lightRef = obj.userData.lightRef;
                if (lightRef) {
                    lightRef.userData.on = !lightRef.userData.on;
                    lightRef.intensity = lightRef.userData.on ? lightRef.userData.baseIntensity : 0;
                }
            }
        }
    }
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

const size = livingRoom.size;
const windowLight = new THREE.SpotLight(
    WINDOW_SPOT_COLOR, WINDOW_SPOT_INTENSITY, WINDOW_SPOT_DISTANCE,
    WINDOW_SPOT_ANGLE, WINDOW_SPOT_PENUMBRA,
);
windowLight.position.set(WINDOW_SPOT_POSITION.x, WINDOW_SPOT_POSITION.y, -size.depth / 2 - 0.5);
windowLight.target.position.set(0, 0, 0);
windowLight.castShadow = true;
windowLight.shadow.mapSize.set(WINDOW_SPOT_SHADOW_MAP_SIZE, WINDOW_SPOT_SHADOW_MAP_SIZE);
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
    scene.fog.color.copy(bgColor);
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

    // 门开合动画
    if (door) {
        const doorPivot = door.userData.doorPivot;
        if (doorPivot) {
            const doorDiff = door.userData.targetRotation - doorPivot.rotation.y;
            if (Math.abs(doorDiff) > 0.005) {
                doorPivot.rotation.y += doorDiff * 0.08;
            } else {
                if (doorPivot.rotation.y !== door.userData.targetRotation) {
                    doorPivot.rotation.y = door.userData.targetRotation;
                    rebuildNavGrid();
                }
            }
        }
    }

    // 窗帘开合动画
    if (curtainPanels.length > 0) {
        const panel0 = curtainPanels[0];
        const sign0  = panel0.userData.side;
        const openAmount = Math.abs(panel0.position.x - sign0 * CURTAIN_CLOSED_X)
                         / (CURTAIN_OPEN_X - CURTAIN_CLOSED_X);

        curtainPanels.forEach(panel => {
            const sign = panel.userData.side;
            const target = sign * curtainTargetX;
            const diff = target - panel.position.x;
            if (Math.abs(diff) > CURTAIN_SNAP_THRESH) {
                panel.position.x += diff * CURTAIN_EASE_FACTOR;
            } else {
                panel.position.x = target;
            }

            const orig = panel.userData.origPositions;
            if (!orig) return;
            const pos = panel.geometry.attributes.position;
            const panelW = CURTAIN_CLOSED_X * 2;

            for (let i = 0; i < pos.count; i++) {
                const ox = orig[i * 3];
                const oy = orig[i * 3 + 1];
                const oz = orig[i * 3 + 2];

                const rawT = (ox + panelW / 2) / panelW;
                const t = sign === -1 ? rawT : 1 - rawT;

                const rodEndLocal = sign * CURTAIN_ROD_HALF - panel.position.x;
                const closedEdge = ox;
                const openEdge = rodEndLocal - sign * panelW * CURTAIN_PLEAT_COMPRESSION * t;
                const newX = closedEdge + (openEdge - closedEdge) * openAmount;

                const pleat = Math.sin(ox * CURTAIN_PLEAT_FREQ_OX + t * CURTAIN_PLEAT_FREQ_T)
                            * CURTAIN_PLEAT_AMPLITUDE * openAmount * (1 - t);

                pos.setXYZ(i, newX, oy, oz + pleat);
            }
            pos.needsUpdate = true;
            panel.geometry.computeVertexNormals();
        });

        // 窗帘联动灯光
        const curtainSunF  = lerp(CURTAIN_SUN_FACTOR,   1, openAmount);
        const curtainSpotF = lerp(CURTAIN_SPOT_FACTOR,  1, openAmount);
        const curtainFillF = lerp(CURTAIN_FILL_FACTOR,  1, openAmount);
        const curtainAmbF  = lerp(CURTAIN_AMBIENT_BOOST, 1, openAmount);
        sun.intensity          = sunBaseIntensity     * curtainSunF;
        windowLight.intensity  = spotBaseIntensity    * curtainSpotF;
        fill.intensity         = fillBaseIntensity    * curtainFillF;
        ambientLight.intensity = ambientBaseIntensity * curtainAmbF;
    }

    composer.render();
}
animate();
