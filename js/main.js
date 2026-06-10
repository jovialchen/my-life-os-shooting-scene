/**
 * 主入口：场景初始化、组装、灯光、后期处理、动画循环
 *
 * 模块结构：
 *   js/config.js          — 全局常量
 *   js/materials.js       — 所有材质
 *   js/room/              — 房间壳体、窗户、装饰
 *   js/furniture/         — 沙发、椅子、茶几、边桌、落地灯、书架
 *   js/character/         — 人形角色
 *   js/interaction/       — 拖拽交互
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
    BLOOM_STRENGTH, BLOOM_RADIUS, BLOOM_THRESHOLD,
    // 轨道控制器
    ORBIT_DAMPING, ORBIT_MIN_DISTANCE, ORBIT_MAX_DISTANCE, ORBIT_MAX_POLAR, MAX_PIXEL_RATIO,
    // 灯光
    AMBIENT_LIGHT_COLOR, AMBIENT_LIGHT_INTENSITY,
    SUN_COLOR, SUN_INTENSITY, SUN_POSITION,
    SUN_SHADOW_MAP_SIZE, SUN_SHADOW_LEFT, SUN_SHADOW_RIGHT, SUN_SHADOW_TOP, SUN_SHADOW_BOTTOM,
    SUN_SHADOW_NEAR, SUN_SHADOW_FAR, SUN_SHADOW_RADIUS, SUN_SHADOW_BIAS,
    FILL_LIGHT_COLOR, FILL_LIGHT_INTENSITY, FILL_LIGHT_POSITION,
    WINDOW_SPOT_COLOR, WINDOW_SPOT_INTENSITY, WINDOW_SPOT_DISTANCE, WINDOW_SPOT_ANGLE, WINDOW_SPOT_PENUMBRA,
    WINDOW_SPOT_POSITION, WINDOW_SPOT_SHADOW_MAP_SIZE,
    // 窗帘动画
    CURTAIN_CLOSED_X, CURTAIN_OPEN_X, CURTAIN_SNAP_THRESH, CURTAIN_EASE_FACTOR,
    CURTAIN_ROD_HALF, CURTAIN_PLEAT_COMPRESSION, CURTAIN_PLEAT_FREQ_OX, CURTAIN_PLEAT_FREQ_T, CURTAIN_PLEAT_AMPLITUDE,
    // 一天时间系统
    TIME_PRESETS, SUN_ORBIT_RADIUS,
    // 窗帘衰减比例
    CURTAIN_SUN_FACTOR, CURTAIN_SPOT_FACTOR, CURTAIN_FILL_FACTOR, CURTAIN_AMBIENT_BOOST,
    // 点击检测
    CLICK_DRAG_THRESHOLD,
    // 缩略图
    THUMB_SIZE, THUMB_AMBIENT_COLOR, THUMB_AMBIENT_INTENSITY,
    THUMB_LIGHT_COLOR, THUMB_LIGHT_INTENSITY, THUMB_LIGHT_POSITION,
    THUMB_CAMERA_FOV, THUMB_CAMERA_ASPECT, THUMB_CAMERA_NEAR, THUMB_CAMERA_FAR,
    THUMB_DIST_MULTIPLIER, THUMB_OFFSET_XZ, THUMB_OFFSET_Y,
} from './config.js';

// ── 房间 ──
import { createRoom }       from './room/room.js';
import { createDoor }       from './room/door.js';
import { createWindow, createCurtains, createPlant } from './room/window.js';
import { createRug, createWallArt } from './room/decorations.js';

// ── 家具 ──
import { createSofa }       from './furniture/sofa.js';
import { createChair }      from './furniture/chair.js';
import { createFloorLamp }  from './furniture/floorLamp.js';
import { createCeilingLight } from './furniture/ceilingLight.js';
import { createCoffeeTable } from './furniture/coffeeTable.js';
import { createSideTable }  from './furniture/sideTable.js';
import { createBookshelf }  from './furniture/bookshelf.js';

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
let lookAtBound = false; // 标记 LookAt 是否已绑定

// ============================================================
//  组装场景
// ============================================================

// 房间结构
scene.add(createRoom());

// 可拖拽对象（保存引用）
const door         = createDoor();
const windowGroup  = createWindow();
const curtains     = createCurtains();
const plant        = createPlant();
const rug          = createRug();
const wallArt      = createWallArt();
const { sofa, cushions: sofaCushions } = createSofa();
const chair        = createChair();
const { group: floorLamp, light: floorLampBulb } = createFloorLamp();
const { group: ceilingLight, light: ceilingBulb } = createCeilingLight();
const coffeeTable  = createCoffeeTable();
const { table: sideTable, book: sideTableBook } = createSideTable();
const { shelf: bookshelf, books: shelfBooks }    = createBookshelf();
const humanoid     = createHumanoid();

// 标记墙面物体
wallArt.userData.surface   = 'wall-left';
wallArt.userData.crossWall = true; // 画作可在不同墙面间拖拽
curtains.userData.surface  = 'wall-back';

scene.add(door, windowGroup, curtains, plant, rug, wallArt);
scene.add(sofa, chair, floorLamp, ceilingLight, coffeeTable, sideTable, bookshelf);
scene.add(sideTableBook, ...shelfBooks, ...sofaCushions);
scene.add(humanoid);

// 标记灯具（可点击开关）
ceilingLight.userData.toggleType = 'light';
ceilingLight.userData.lightRef = ceilingBulb;
ceilingBulb.userData.on = true;
ceilingBulb.userData.baseIntensity = ceilingBulb.intensity;

floorLamp.userData.toggleType = 'light';
floorLamp.userData.lightRef = floorLampBulb;
floorLampBulb.userData.on = true;
floorLampBulb.userData.baseIntensity = floorLampBulb.intensity;

// 标记小物品（可放置在任意平面上）
const smallItems = [plant, sideTableBook, ...shelfBooks, ...sofaCushions];
smallItems.forEach(item => {
    item.userData.movableType = 'small-item';
    // 计算物品底部到中心的偏移（用几何尺寸，与位置无关）
    item.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(item);
    const size = new THREE.Vector3();
    box.getSize(size);
    item.userData.itemBottomOffset = size.y / 2;
});

// ── 小物品旋转约束 ──
// 书本：水平 + 垂直都可旋转（'any'）
[sideTableBook, ...shelfBooks].forEach(book => {
    book.userData.rotationConstraint = 'any';
});
// 盆栽/靠枕：只能水平旋转（'horizontal'）
[plant, ...sofaCushions].forEach(item => {
    item.userData.rotationConstraint = 'horizontal';
});

// ── 父子携带关系 ──
// 书架 → 书本
bookshelf.userData.children = [...shelfBooks];
shelfBooks.forEach(book => { book.userData.parentGroup = bookshelf; });
// 边桌 → 书本
sideTable.userData.children = [sideTableBook];
sideTableBook.userData.parentGroup = sideTable;

// ============================================================
//  侧边栏：Tab 式面板（物品 / 人物 / 规则 / 语言）
// ============================================================
(function initSidebar() {
    // ── i18n 文本 ──
    const TEXTS = {
        zh: {
            tabs: ['物品', '人物', '规则', '语言'],
            time: '时间',
            timeNames: TIME_PRESETS.map(p => p.name),
            rules: {
                title: '游戏规则',
                controls: '基本操作',
                controlsList: [
                    '拖拽旋转视角',
                    '滚轮缩放',
                    '右键平移视角',
                    '拖拽移动家具 / 角色',
                    '点击窗帘 / 门 开合',
                    '点击灯具 开/关',
                    '选中物体后 Q/E 旋转45°',
                    '选中书本后 R 垂直翻转',
                ],
                nav: '角色移动',
                navList: [
                    '点击地面，角色自动走向目标',
                    '角色会绕开家具障碍物',
                    '门打开时角色会绕行门板',
                    '移动书架/桌子时，上面的物品会一起带走',
                    '单独拖拽物品可从家具上拿下来',
                ],
                time: '时间系统',
                timeDesc: '拖动底部时间滑块可切换一天中的不同时段，灯光和天空颜色会随之变化。窗帘的开合也会影响室内光线。',
            },
            character: {
                title: '场景角色',
                name: '小人',
                desc: '点击地面让她走动，她会自动避开家具。可以拖拽移动她的位置。',
            },
            langLabel: '语言 / Language',
        },
        en: {
            tabs: ['Items', 'Cast', 'Rules', 'Language'],
            time: 'Time',
            timeNames: TIME_PRESETS.map(p => p.nameEn || p.name),
            rules: {
                title: 'Game Rules',
                controls: 'Basic Controls',
                controlsList: [
                    'Drag to rotate view',
                    'Scroll to zoom',
                    'Right-click to pan',
                    'Drag furniture / character to move',
                    'Click curtain / door to open/close',
                    'Click lights to toggle on/off',
                    'Q/E to rotate selected object 45°',
                    'R to flip book vertically',
                ],
                nav: 'Character Movement',
                navList: [
                    'Click on the floor to walk',
                    'Character avoids furniture obstacles',
                    'Character walks around open doors',
                    'Moving shelf/table carries items on top',
                    'Drag items off furniture to detach them',
                ],
                time: 'Time System',
                timeDesc: 'Drag the time slider at the bottom to switch between times of day. Lighting and sky colors change accordingly. Curtain state also affects indoor lighting.',
            },
            character: {
                title: 'Scene Characters',
                name: 'Character',
                desc: 'Click the floor to make her walk — she avoids furniture automatically. Drag to reposition.',
            },
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

    // ── 物品清单 ──
    const items = [
        { obj: sofa,        name: '三人沙发',   nameEn: 'Sofa',            cat: '家具',   catEn: 'Furniture' },
        { obj: chair,       name: '单人椅',     nameEn: 'Chair',           cat: '家具',   catEn: 'Furniture' },
        { obj: coffeeTable, name: '圆形茶几',   nameEn: 'Coffee Table',    cat: '家具',   catEn: 'Furniture' },
        { obj: sideTable,   name: '圆形边桌',   nameEn: 'Side Table',      cat: '家具',   catEn: 'Furniture' },
        { obj: floorLamp,   name: '落地灯',     nameEn: 'Floor Lamp',      cat: '家具',   catEn: 'Furniture' },
        { obj: ceilingLight, name: '顶灯',     nameEn: 'Ceiling Light',   cat: '灯具',   catEn: 'Lighting' },
        { obj: bookshelf,   name: '三层书架',   nameEn: 'Bookshelf',       cat: '家具',   catEn: 'Furniture' },
        { obj: wallArt,     name: '装饰画',     nameEn: 'Wall Art',        cat: '挂画',   catEn: 'Wall Art' },
        { obj: curtains,    name: '窗帘',       nameEn: 'Curtains',        cat: '窗帘',   catEn: 'Curtains' },
        { obj: rug,         name: '地毯',       nameEn: 'Rug',             cat: '地毯',   catEn: 'Rug' },
        { obj: plant,       name: '窗台盆栽',   nameEn: 'Window Plant',    cat: '小物品', catEn: 'Small Items' },
        { obj: sideTableBook, name: '边桌书本', nameEn: 'Side Table Book', cat: '小物品', catEn: 'Small Items' },
        { obj: sofaCushions[0], name: '靠枕（金）', nameEn: 'Cushion (Gold)', cat: '小物品', catEn: 'Small Items' },
        { obj: sofaCushions[1], name: '靠枕（绿）', nameEn: 'Cushion (Green)', cat: '小物品', catEn: 'Small Items' },
        { obj: door,        name: '门',         nameEn: 'Door',            cat: '家具',   catEn: 'Furniture' },
        { obj: humanoid,    name: '小人',       nameEn: 'Character',       cat: '角色',   catEn: 'Character' },
    ];
    shelfBooks.forEach((book, i) => {
        items.push({ obj: book, name: `书架书本 ${i + 1}`, nameEn: `Shelf Book ${i + 1}`, cat: '小物品', catEn: 'Small Items' });
    });

    // ── 渲染物品面板 ──
    const itemsPanel = document.querySelector('[data-panel="items"]');
    const categories = [
        { zh: '家具', en: 'Furniture' },
        { zh: '灯具', en: 'Lighting' },
        { zh: '挂画', en: 'Wall Art' },
        { zh: '小物品', en: 'Small Items' },
        { zh: '窗帘', en: 'Curtains' },
        { zh: '地毯', en: 'Rug' },
        { zh: '角色', en: 'Character' },
    ];

    function renderItems() {
        itemsPanel.innerHTML = '';
        categories.forEach(cat => {
            const catItems = items.filter(i => i.cat === cat.zh);
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

    // ── 渲染语言面板 ──
    const langPanel = document.querySelector('[data-panel="lang"]');
    function renderLang() {
        langPanel.innerHTML = '';
        const label = document.createElement('div');
        label.className = 'rules-section';
        label.innerHTML = `<h3>${t('langLabel')}</h3>`;
        langPanel.appendChild(label);

        ['zh', 'en'].forEach(code => {
            const btn = document.createElement('button');
            btn.className = 'lang-btn' + (lang === code ? ' active' : '');
            btn.textContent = code === 'zh' ? '中文' : 'English';
            btn.addEventListener('click', () => {
                if (lang === code) return;
                lang = code;
                localStorage.setItem('scene-lang', lang);
                refreshAll();
            });
            langPanel.appendChild(btn);
        });
    }
    renderLang();

    // ── 刷新所有面板 + tab 文字 ──
    function refreshAll() {
        // 更新 tab 名称
        document.querySelectorAll('.sb-tab').forEach((tab, i) => {
            tab.textContent = TEXTS[lang].tabs[i];
        });
        // 更新时间标签
        const timeBarLabel = document.querySelector('#time-bar label');
        if (timeBarLabel) timeBarLabel.textContent = `☀ ${t('time')}`;
        const slider = document.getElementById('time-slider');
        const timeLabelEl = document.getElementById('time-label');
        if (slider && timeLabelEl) {
            timeLabelEl.textContent = t('timeNames')[Math.round(parseFloat(slider.value))] || '';
        }
        // 重新渲染各面板
        renderItems();
        renderCharacters();
        renderRules();
        renderLang();
    }

    // ── Tab 切换 ──
    document.querySelectorAll('.sb-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.sb-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.sb-panel').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            const panel = document.querySelector(`[data-panel="${tab.dataset.tab}"]`);
            if (panel) panel.classList.add('active');
        });
    });

    // ── 侧边栏收起/展开 ──
    const sidebar = document.getElementById('sidebar');
    const toggle  = document.getElementById('sb-toggle');
    if (toggle && sidebar) {
        toggle.addEventListener('click', () => {
            sidebar.classList.toggle('closed');
            toggle.textContent = sidebar.classList.contains('closed') ? '▶' : '◀';
        });
    }

    // ── 暴露 refreshAll 给时间滑块更新语言 ──
    window._sidebarRefresh = refreshAll;
    window._sidebarLang = () => lang;
})();

// ============================================================
//  拖拽交互（所有物体均可拖拽移动）
// ============================================================
const movables = [
    wallArt, rug,
    sofa, chair, floorLamp, coffeeTable, sideTable, bookshelf,
    humanoid,
    ...smallItems,
];
createDragControls(movables, camera, renderer, controls, scene, {
    onDrop: rebuildNavGrid,
});

// ============================================================
//  角色点击走动（自动绕开家具）
// ============================================================
const furnitureObstacles = [sofa, chair, coffeeTable, sideTable, bookshelf, floorLamp];
initWalker(humanoid, camera, renderer, scene, furnitureObstacles, door);

// ============================================================
//  窗帘点击开合
// ============================================================
const curtainPanels = [];
curtains.children.forEach(child => {
    if (child.isMesh && child.geometry.type === 'PlaneGeometry') {
        curtainPanels.push(child);
    }
});

let curtainOpen = true;
let curtainTargetX = CURTAIN_OPEN_X;

// 初始窗帘打开：直接设置面板位置，避免从暗到亮渐变
curtainPanels.forEach(panel => {
    panel.position.x = panel.userData.side * CURTAIN_OPEN_X;
});

// 点击检测（区分点击与拖拽）
const curtainRaycaster = new THREE.Raycaster();
const curtainMouse = new THREE.Vector2();
let curtainPointerDownPos = null;

renderer.domElement.addEventListener('pointerdown', e => {
    curtainPointerDownPos = { x: e.clientX, y: e.clientY };
});

renderer.domElement.addEventListener('pointerup', e => {
    if (!curtainPointerDownPos) return;
    const dx = e.clientX - curtainPointerDownPos.x;
    const dy = e.clientY - curtainPointerDownPos.y;
    curtainPointerDownPos = null;
    // 移动超过阈值视为拖拽，不触发点击
    if (Math.sqrt(dx * dx + dy * dy) > CLICK_DRAG_THRESHOLD) return;

    curtainMouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    curtainMouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    curtainRaycaster.setFromCamera(curtainMouse, camera);
    const hits = curtainRaycaster.intersectObjects(curtainPanels, false);
    if (hits.length > 0) {
        curtainOpen = !curtainOpen;
        curtainTargetX = curtainOpen ? CURTAIN_OPEN_X : CURTAIN_CLOSED_X;
    }

    // 门点击开合
    const doorHits = curtainRaycaster.intersectObjects(door.children, true);
    if (doorHits.length > 0) {
        door.userData.isOpen = !door.userData.isOpen;
        door.userData.targetRotation = door.userData.isOpen ? Math.PI / 2 : 0;
    }

    // 灯具点击开关
    const lightHits = curtainRaycaster.intersectObjects([ceilingLight, floorLamp], true);
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
});

// ============================================================
//  灯光系统（暖色黄昏氛围）
// ============================================================

// 环境光 — 柔和暖色基底
const ambientLight = new THREE.AmbientLight(AMBIENT_LIGHT_COLOR, AMBIENT_LIGHT_INTENSITY);
scene.add(ambientLight);

// 主方向光 — 模拟夕阳从窗户照入
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

// 补光 — 另一侧冷色，增加层次
const fill = new THREE.DirectionalLight(FILL_LIGHT_COLOR, FILL_LIGHT_INTENSITY);
fill.position.set(FILL_LIGHT_POSITION.x, FILL_LIGHT_POSITION.y, FILL_LIGHT_POSITION.z);
scene.add(fill);

// 窗外聚光 — 暖光从南面窗户打入（后墙 z=-ROOM_DEPTH/2，窗户已在 window.js 中移到南墙）
const windowLight = new THREE.SpotLight(
    WINDOW_SPOT_COLOR, WINDOW_SPOT_INTENSITY, WINDOW_SPOT_DISTANCE,
    WINDOW_SPOT_ANGLE, WINDOW_SPOT_PENUMBRA,
);
windowLight.position.set(WINDOW_SPOT_POSITION.x, WINDOW_SPOT_POSITION.y, -ROOM_DEPTH / 2 - 0.5);
windowLight.target.position.set(0, 0, 0);
windowLight.castShadow = true;
windowLight.shadow.mapSize.set(WINDOW_SPOT_SHADOW_MAP_SIZE, WINDOW_SPOT_SHADOW_MAP_SIZE);
scene.add(windowLight);
scene.add(windowLight.target);

// 落地灯点光源已在 createFloorLamp 中自动生成

// ============================================================
//  一天时间系统
// ============================================================

function smoothstep(t) { return t * t * (3 - 2 * t); }
function lerp(a, b, t) { return a + (b - a) * t; }
function lerpHSL(h1, s1, l1, h2, s2, l2, t) {
    // 色相取最短弧
    let dh = h2 - h1;
    if (dh > 0.5) dh -= 1;
    if (dh < -0.5) dh += 1;
    return { h: (h1 + dh * t + 1) % 1, s: lerp(s1, s2, t), l: lerp(l1, l2, t) };
}

// 基础强度（由时间滑块设置，窗帘在此基础上衰减）
let sunBaseIntensity     = SUN_INTENSITY;
let ambientBaseIntensity = AMBIENT_LIGHT_INTENSITY;
let fillBaseIntensity    = FILL_LIGHT_INTENSITY;
let spotBaseIntensity    = WINDOW_SPOT_INTENSITY;

function updateTimeOfDay(value) {
    const idx = Math.min(Math.floor(value), TIME_PRESETS.length - 2);
    const t = smoothstep(value - idx);
    const a = TIME_PRESETS[idx];
    const b = TIME_PRESETS[idx + 1];

    // 太阳位置（球坐标 → 直角坐标）
    const az = lerp(a.az, b.az, t) * Math.PI / 180;
    const el = lerp(a.el, b.el, t) * Math.PI / 180;
    sun.position.set(
        -SUN_ORBIT_RADIUS * Math.cos(el) * Math.sin(az), // 取反：方位角 90°=东 → x<0（左墙）
        SUN_ORBIT_RADIUS * Math.sin(el),
        SUN_ORBIT_RADIUS * Math.cos(el) * Math.cos(az),
    );

    // 太阳颜色（HSL 插值）
    const hsl = lerpHSL(a.h, a.s, a.l, b.h, b.s, b.l, t);
    sun.color.setHSL(hsl.h, hsl.s, hsl.l);

    // 各光源基础强度
    sunBaseIntensity     = lerp(a.sun,     b.sun,     t);
    ambientBaseIntensity = lerp(a.ambient, b.ambient, t);
    fillBaseIntensity    = lerp(a.fill,    b.fill,    t);
    spotBaseIntensity    = lerp(a.spot,    b.spot,    t);

    // 背景 & 雾色
    const bgColor = new THREE.Color(a.bg).lerp(new THREE.Color(b.bg), t);
    scene.background = bgColor;
    scene.fog.color.copy(bgColor);
}

// 初始应用中午（slider 默认 value=2）
updateTimeOfDay(2);

// 时间滑块事件
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

    // 指南针旋转（相机方位角 → CSS rotate）
    if (compassRing) {
        const camAngle = Math.atan2(
            controls.target.x - camera.position.x,
            controls.target.z - camera.position.z,
        );
        compassRing.style.transform = `rotate(${camAngle * 180 / Math.PI}deg)`;
    }

    // VRM 加载完成后绑定 LookAt（只执行一次）
    if (!lookAtBound && humanoid.userData.vrm) {
        setHumanoidLookAt(camera);
        lookAtBound = true;
    }

    // 驱动 VRM 动画：spring bone 物理 + 眨眼 + 表情呼吸
    updateHumanoid(delta);

    // 角色步行：点击地面 → 走过去
    updateWalker(delta);

    // 门开合动画
    const doorPivot = door.userData.doorPivot;
    if (doorPivot) {
        const doorDiff = door.userData.targetRotation - doorPivot.rotation.y;
        if (Math.abs(doorDiff) > 0.005) {
            doorPivot.rotation.y += doorDiff * 0.08;
        } else {
            if (doorPivot.rotation.y !== door.userData.targetRotation) {
                doorPivot.rotation.y = door.userData.targetRotation;
                rebuildNavGrid(); // 门动画结束，更新寻路网格
            }
        }
    }

    // 窗帘开合动画（缓动 + 褶皱变形）
    // 先计算 openAmount（0=全关, 1=全开），用于后续灯光联动
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

        // 褶皱变形：外边缘钉在杆端，内侧压缩堆积
        const orig = panel.userData.origPositions;
        if (!orig) return;
        const pos = panel.geometry.attributes.position;
        const panelW = CURTAIN_CLOSED_X * 2; // 2.5

        for (let i = 0; i < pos.count; i++) {
            const ox = orig[i * 3];
            const oy = orig[i * 3 + 1];
            const oz = orig[i * 3 + 2];

            // t: 0 = 外侧（杆端），1 = 内侧（窗中央）
            // 左面板：ox=-panelW/2 是杆端 → t=0；右面板需要翻转
            const rawT = (ox + panelW / 2) / panelW;
            const t = sign === -1 ? rawT : 1 - rawT;

            // 外侧钉在杆端，内侧向杆端压缩
            // newX 是局部坐标，世界坐标 = panel.position.x + newX
            // 外边缘(t=0)：世界坐标 = sign*CURTAIN_ROD_HALF → 局部 = sign*CURTAIN_ROD_HALF - panel.position.x
            // 内边缘(t=1)：从杆端向内缩 panelW*CURTAIN_PLEAT_COMPRESSION
            const rodEndLocal = sign * CURTAIN_ROD_HALF - panel.position.x;
            const closedEdge = ox;
            const openEdge = rodEndLocal - sign * panelW * CURTAIN_PLEAT_COMPRESSION * t;
            const newX = closedEdge + (openEdge - closedEdge) * openAmount;

            // 褶皱：越靠近外侧越明显（堆积在杆附近）
            const pleat = Math.sin(ox * CURTAIN_PLEAT_FREQ_OX + t * CURTAIN_PLEAT_FREQ_T)
                        * CURTAIN_PLEAT_AMPLITUDE * openAmount * (1 - t);

            pos.setXYZ(i, newX, oy, oz + pleat);
        }
        pos.needsUpdate = true;
        panel.geometry.computeVertexNormals();
    });

    // 窗帘联动灯光：基于时间系统的基础强度 × 窗帘衰减系数
    const curtainSunF   = lerp(CURTAIN_SUN_FACTOR,   1, openAmount);
    const curtainSpotF  = lerp(CURTAIN_SPOT_FACTOR,  1, openAmount);
    const curtainFillF  = lerp(CURTAIN_FILL_FACTOR,  1, openAmount);
    const curtainAmbF   = lerp(CURTAIN_AMBIENT_BOOST, 1, openAmount);
    sun.intensity          = sunBaseIntensity     * curtainSunF;
    windowLight.intensity  = spotBaseIntensity    * curtainSpotF;
    fill.intensity         = fillBaseIntensity    * curtainFillF;
    ambientLight.intensity = ambientBaseIntensity * curtainAmbF;

    composer.render();
}
animate();
