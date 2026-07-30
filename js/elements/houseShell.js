/**
 * 外壳房子 + 岛屿地面 —— 从 GLB 模型加载
 * 加载 models/house.glb（房子）与 models/island.glb（岛屿地面 + 四季树）
 * 两个模型都加载完成后解析 surface 属性（walkable/obstacle），驱动导航网格
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { registerDoor } from '../systems/doors.js';
import { parseSurfaces } from '../systems/surfaceParser.js';
import { applyToonShading } from '../systems/toon.js';

// ── 草地/岛屿参数（花园/栅栏/寻路等模块依赖）──
const GRASS_RADIUS = 25;
const GRASS_CENTER_X = 0;
const GRASS_CENTER_Z = 5; // 公寓中心 z=5

// ── 主函数 ──

/**
 * @param {{ onModelsReady?: (info: {
 *   walkable: THREE.Mesh[], obstacles: THREE.Mesh[],
 *   leaves: Array, grassMaterials: Array,
 * }) => void }} callbacks - 房子和岛屿都加载解析完成后触发
 */
export function createHouseShell({ onModelsReady } = {}) {
    const house = new THREE.Group();
    house.name = 'houseShell';

    const grass = {
        centerX: GRASS_CENTER_X,
        centerZ: GRASS_CENTER_Z,
        radius: GRASS_RADIUS,
    };

    const loader = new GLTFLoader();

    // 两个模型的解析结果，齐了就触发 onModelsReady
    const pending = { island: null, house: null };
    function maybeReady() {
        if (!pending.island || !pending.house) return;
        onModelsReady?.({
            walkable: [...pending.island.walkable, ...pending.house.walkable],
            obstacles: [...pending.island.obstacles, ...pending.house.obstacles],
            leaves: pending.island.leaves,
            grassMaterials: pending.island.grassMaterials,
        });
    }

    // ── 异步加载岛屿模型（地面 + 树，替代原平面草地）──
    loader.load(
        './models/island.glb',
        (gltf) => {
            const island = gltf.scene;
            island.name = 'islandModel';
            applyToonShading(island);   // 三渲二：Standard → MeshToonMaterial

            const trees = [];           // 树干 {name, x, z}（树叶缩放基点用）
            const leaves = [];          // 四季树叶 mesh（含缩放基点）
            const grassMaterials = [];  // 草顶材质（季节变色目标）

            island.traverse((child) => {
                if (!child.isMesh) return;
                child.castShadow = true;
                child.receiveShadow = true;

                // WALK_ 顶面是逻辑行走面，不渲染（寻路系统用）
                if (child.name.startsWith('WALK_')) {
                    child.visible = false;
                    child.castShadow = false;
                    child.receiveShadow = false;
                }

                if (child.name.endsWith('_trunk')) {
                    trees.push({ name: child.name, x: child.position.x, z: child.position.z });
                } else if (child.userData.season_leaves) {
                    // 树叶顶点为世界坐标（原点在岛中心），冬季缩放需绕树干基点
                    leaves.push({ mesh: child, anchor: null });
                }

                const mats = Array.isArray(child.material) ? child.material : [child.material];
                for (const m of mats) {
                    if (m.name === 'MAT_grass' && !grassMaterials.includes(m)) {
                        grassMaterials.push(m);
                    }
                }
            });

            // 树叶缩放基点 = 同编号树干位置（树根处）
            for (const leaf of leaves) {
                const trunk = trees.find(t =>
                    t.name.replace('_trunk', '') === leaf.mesh.name.replace('_leaves', ''));
                if (trunk) leaf.anchor = new THREE.Vector3(trunk.x, 0, trunk.z);
            }

            house.add(island);
            console.log('[HouseShell] island.glb loaded');

            const surfaces = parseSurfaces(island);
            pending.island = { ...surfaces, leaves, grassMaterials };
            maybeReady();
        },
        undefined,
        (error) => {
            console.error('[HouseShell] Failed to load island.glb:', error);
        },
    );

    // ── 异步加载 GLB 房子模型 ──
    loader.load(
        './models/house.glb',
        (gltf) => {
            const model = gltf.scene;
            model.name = 'houseModel';
            applyToonShading(model);   // 三渲二：Standard → MeshToonMaterial

            // 给所有 mesh 打上 isOccluder 标记（墙体遮挡透明系统用）
            // 带 interactable_type='door' 的门板注册到门交互系统
            // WALK_ 面是逻辑行走面，不渲染
            model.traverse((child) => {
                if (child.isMesh) {
                    child.userData.isOccluder = true;
                    child.castShadow = true;
                    child.receiveShadow = true;
                    if (child.name.startsWith('WALK_')) {
                        child.visible = false;
                        child.castShadow = false;
                        child.receiveShadow = false;
                    }
                }
                if (child.userData.interactable_type === 'door') {
                    registerDoor(child);
                }
            });

            house.add(model);
            console.log('[HouseShell] house.glb loaded');

            pending.house = parseSurfaces(model);
            maybeReady();
        },
        (progress) => {
            if (progress.total > 0) {
                const pct = Math.round((progress.loaded / progress.total) * 100);
                if (pct % 20 === 0) console.log(`[HouseShell] loading... ${pct}%`);
            }
        },
        (error) => {
            console.error('[HouseShell] Failed to load house.glb:', error);
        },
    );

    return {
        group: house,
        door: null,          // 门已改由 systems/doors.js 管理（GLB custom properties）
        grass,
    };
}
