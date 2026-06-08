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
    BLOOM_STRENGTH, BLOOM_RADIUS, BLOOM_THRESHOLD
} from './config.js';

// ── 房间 ──
import { createRoom }       from './room/room.js';
import { createWindow, createCurtains, createPlant } from './room/window.js';
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

// 可拖拽对象（保存引用）
const windowGroup  = createWindow();
const curtains     = createCurtains();
const plant        = createPlant();
const rug          = createRug();
const wallArt      = createWallArt();
const sofa         = createSofa();
const chair        = createChair();
const floorLamp    = createFloorLamp();
const coffeeTable  = createCoffeeTable();
const { table: sideTable, book: sideTableBook } = createSideTable();
const { shelf: bookshelf, books: shelfBooks }    = createBookshelf();
const humanoid     = createHumanoid();

// 标记墙面物体
wallArt.userData.surface   = 'wall-left';
wallArt.userData.crossWall = true; // 画作可在不同墙面间拖拽

scene.add(windowGroup, curtains, plant, rug, wallArt);
scene.add(sofa, chair, floorLamp, coffeeTable, sideTable, bookshelf);
scene.add(sideTableBook, ...shelfBooks);
scene.add(humanoid);

// 标记小物品（可放置在任意平面上）
const smallItems = [plant, sideTableBook, ...shelfBooks];
smallItems.forEach(item => {
    item.userData.movableType = 'small-item';
    // 计算物品底部到中心的偏移（用于吸附时定位）
    item.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(item);
    item.userData.itemBottomOffset = item.position.y - box.min.y;
});

// ============================================================
//  侧边栏：物品列表 + 缩略图
// ============================================================
(function initSidebar() {
    // 缩略图渲染器
    const thumbSize = 96;
    const thumbRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    thumbRenderer.setSize(thumbSize, thumbSize);
    thumbRenderer.setPixelRatio(1);
    thumbRenderer.shadowMap.enabled = false;
    thumbRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    thumbRenderer.toneMappingExposure = TONE_MAPPING_EXPOSURE;
    const thumbScene = new THREE.Scene();
    thumbScene.background = new THREE.Color(BG_COLOR);
    thumbScene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const thumbLight = new THREE.DirectionalLight(0xffeedd, 0.8);
    thumbLight.position.set(2, 3, 2);
    thumbScene.add(thumbLight);
    const thumbCam = new THREE.PerspectiveCamera(40, 1, 0.1, 50);

    function renderThumbnail(obj) {
        // 计算包围盒
        const box = new THREE.Box3().setFromObject(obj);
        const center = new THREE.Vector3();
        const size = new THREE.Vector3();
        box.getCenter(center);
        box.getSize(size);

        // 相机定位
        const maxDim = Math.max(size.x, size.y, size.z);
        const dist = maxDim * 2.2;
        thumbCam.position.set(center.x + dist * 0.6, center.y + dist * 0.4, center.z + dist * 0.6);
        thumbCam.lookAt(center);
        thumbCam.updateProjectionMatrix();

        // 临时加入缩略图场景
        const parent = obj.parent;
        if (parent) parent.remove(obj);
        thumbScene.add(obj);
        thumbRenderer.render(thumbScene, thumbCam);
        const url = thumbRenderer.domElement.toDataURL();
        thumbScene.remove(obj);
        if (parent) parent.add(obj);
        return url;
    }

    // 物品清单
    const items = [
        { obj: sofa,        name: '三人沙发',   cat: '家具',   room: '客厅' },
        { obj: chair,       name: '单人椅',     cat: '家具',   room: '客厅' },
        { obj: coffeeTable, name: '圆形茶几',   cat: '家具',   room: '客厅' },
        { obj: sideTable,   name: '圆形边桌',   cat: '家具',   room: '客厅' },
        { obj: floorLamp,   name: '落地灯',     cat: '家具',   room: '客厅' },
        { obj: bookshelf,   name: '三层书架',   cat: '家具',   room: '客厅' },
        { obj: wallArt,     name: '装饰画',     cat: '挂画',   room: '客厅' },
        { obj: plant,       name: '窗台盆栽',   cat: '小物品', room: '客厅' },
        { obj: sideTableBook, name: '边桌书本', cat: '小物品', room: '客厅' },
        { obj: humanoid,    name: '小人',       cat: '角色',   room: '客厅' },
    ];
    // 书架上的书
    shelfBooks.forEach((book, i) => {
        items.push({ obj: book, name: `书架书本 ${i + 1}`, cat: '小物品', room: '客厅' });
    });

    // 渲染侧边栏
    const sidebar = document.getElementById('sidebar');
    const categories = ['家具', '挂画', '小物品', '角色'];

    categories.forEach(cat => {
        const catItems = items.filter(i => i.cat === cat);
        if (catItems.length === 0) return;

        const title = document.createElement('div');
        title.className = 'sb-title';
        title.textContent = `${cat}（${catItems.length}）`;
        sidebar.appendChild(title);

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
            info.innerHTML = `<div class="sb-name">${item.name}</div><div class="sb-meta">${item.room} · ${item.cat}</div>`;

            div.appendChild(thumb);
            div.appendChild(info);
            sidebar.appendChild(div);
        });
    });
})();

// ============================================================
//  拖拽交互（所有物体均可拖拽移动）
// ============================================================
const movables = [
    wallArt, rug,
    sofa, chair, floorLamp, coffeeTable, sideTable, bookshelf,
    humanoid,
    ...smallItems
];
createDragControls(movables, camera, renderer, controls, scene);

// ============================================================
//  窗帘点击开合
// ============================================================
const curtainPanels = [];
curtains.children.forEach(child => {
    if (child.isMesh && child.geometry.type === 'PlaneGeometry') {
        curtainPanels.push(child);
    }
});

const CURTAIN_CLOSED_X = 1.25;  // 关闭时：每片遮住半窗 (5.0/2/2)
const CURTAIN_OPEN_X = 2.95;   // 打开时：滑到杆两端，不超出杆端头

let curtainOpen = false;
let curtainTargetX = CURTAIN_CLOSED_X;

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
    // 移动超过 5px 视为拖拽，不触发点击
    if (Math.sqrt(dx * dx + dy * dy) > 5) return;

    curtainMouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    curtainMouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    curtainRaycaster.setFromCamera(curtainMouse, camera);
    const hits = curtainRaycaster.intersectObjects(curtainPanels, false);
    if (hits.length > 0) {
        curtainOpen = !curtainOpen;
        curtainTargetX = curtainOpen ? CURTAIN_OPEN_X : CURTAIN_CLOSED_X;
    }
});

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

    // 窗帘开合动画（缓动 + 褶皱变形）
    const ROD_HALF = 3.0; // 窗帘杆半长
    curtainPanels.forEach(panel => {
        const sign = panel.userData.side;
        const target = sign * curtainTargetX;
        const diff = target - panel.position.x;
        if (Math.abs(diff) > 0.005) {
            panel.position.x += diff * 0.08;
        } else {
            panel.position.x = target;
        }

        // 褶皱变形：外边缘钉在杆端，内侧压缩堆积
        const orig = panel.userData.origPositions;
        if (!orig) return;
        const pos = panel.geometry.attributes.position;
        const panelW = CURTAIN_CLOSED_X * 2; // 2.5
        const openAmount = Math.abs(panel.position.x - sign * CURTAIN_CLOSED_X)
                         / (CURTAIN_OPEN_X - CURTAIN_CLOSED_X);

        for (let i = 0; i < pos.count; i++) {
            const ox = orig[i * 3];
            const oy = orig[i * 3 + 1];
            const oz = orig[i * 3 + 2];

            // t: 0 = 外侧（杆端），1 = 内侧（窗中央）
            const t = (ox + panelW / 2) / panelW; // 左右通用：-panelW/2→0, +panelW/2→1

            // 外侧钉在杆端，内侧向杆端压缩
            // newX 是局部坐标，世界坐标 = panel.position.x + newX
            // 外边缘(t=0)：世界坐标 = sign*ROD_HALF → 局部 = sign*ROD_HALF - panel.position.x
            // 内边缘(t=1)：从杆端向内缩 panelW*0.65
            const rodEndLocal = sign * ROD_HALF - panel.position.x;
            const closedEdge = ox;
            const openEdge = rodEndLocal - sign * panelW * 0.65 * t;
            const newX = closedEdge + (openEdge - closedEdge) * openAmount;

            // 褶皱：越靠近外侧越明显（堆积在杆附近）
            const pleat = Math.sin(ox * 12 + t * 8) * 0.04 * openAmount * (1 - t);

            pos.setXYZ(i, newX, oy, oz + pleat);
        }
        pos.needsUpdate = true;
        panel.geometry.computeVertexNormals();
    });

    composer.render();
}
animate();
