/**
 * 外壳房子 + 岛屿花园 —— 从 GLB 模型加载
 * 加载 models/house.glb（房子）与 models/island.glb（岛屿地面 + 季节树 + 花园）
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
 *   trees: Array, flowerGroups: Array, snowman: THREE.Mesh|null,
 *   grassMaterials: Array,
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
            trees: pending.island.trees,
            flowerGroups: pending.island.flowerGroups,
            snowman: pending.island.snowman,
            grassMaterials: pending.island.grassMaterials,
        });
    }

    // ── 异步加载岛屿模型（地面 + 季节树 + 花园，替代原平面草地）──
    loader.load(
        './models/island.glb',
        (gltf) => {
            const island = gltf.scene;
            island.name = 'islandModel';
            applyToonShading(island);   // 三渲二：Standard → MeshToonMaterial

            const trunks = new Map();       // treeKey → {x, z}（缩放锚点用）
            const treeParts = new Map();    // treeKey → { leaves, fruits, snow }
            const flowerGroups = [];        // 应季花卉 [{ mesh, bloomIn, bloomOut }]
            let snowman = null;
            const grassMaterials = [];      // 草顶材质（季节变色目标）

            const partOf = (key) => {
                if (!treeParts.has(key)) treeParts.set(key, {});
                return treeParts.get(key);
            };
            const hexToInt = (h) => (h ? parseInt(h.slice(1), 16) : undefined);

            island.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;

                    // WALK_ 顶面是逻辑行走面，不渲染（寻路系统用）
                    if (child.name.startsWith('WALK_')) {
                        child.visible = false;
                        child.castShadow = false;
                        child.receiveShadow = false;
                    }

                    const mats = Array.isArray(child.material) ? child.material : [child.material];
                    for (const m of mats) {
                        if (m.name === 'MAT_grass' && !grassMaterials.includes(m)) {
                            grassMaterials.push(m);
                        }
                    }
                }

                // 季节标记检查所有节点：多材质 mesh 导出 GLB 时会拆成多 primitive，
                // GLTFLoader 加载为 Group（extras 在 Group 上，子 mesh 没有）
                const ud = child.userData;
                if (child.isMesh && child.name.endsWith('_trunk')) {
                    trunks.set(child.name.replace(/_trunk$/, ''),
                               { x: child.position.x, z: child.position.z });
                } else if (ud.season_leaves && child.isMesh) {
                    // 每棵树克隆独立材质：各自的花色/秋色需要单独着色
                    child.material = child.material.clone();
                    partOf(child.name.replace(/_leaves$/, '')).leaves = child;
                } else if (ud.season_fruits) {
                    partOf(child.name.replace(/_fruits$/, '')).fruits = child;
                } else if (ud.season_snow) {
                    partOf(child.name.replace(/_snow$/, '')).snow = child;
                } else if (ud.season_snowman) {
                    snowman = child;   // Group 或 Mesh，scale/visible 同样生效
                } else if (ud.flower_bloom_in !== undefined) {
                    flowerGroups.push({
                        mesh: child,   // Group 或 Mesh（seasons.js 向下遍历找材质）
                        bloomIn: ud.flower_bloom_in,
                        bloomOut: ud.flower_bloom_out,
                    });
                }
            });

            // 组装季节树：树叶 + 锚点（同 key 树干位置）+ 秋果 + 雪盖
            const trees = [];
            for (const [key, part] of treeParts) {
                if (!part.leaves) continue;
                const tp = trunks.get(key);
                trees.push({
                    leaves: part.leaves,
                    type: part.leaves.userData.tree_type || 'deciduous',
                    spring: hexToInt(part.leaves.userData.leaf_spring) ?? 0xf2a7c3,
                    autumn: hexToInt(part.leaves.userData.leaf_autumn) ?? 0xc9562e,
                    anchor: tp ? new THREE.Vector3(tp.x, 0, tp.z) : null,
                    fruits: part.fruits || null,
                    snow: part.snow || null,
                });
            }

            house.add(island);
            console.log('[HouseShell] island.glb loaded '
                + `(${trees.length} 棵树, ${flowerGroups.length} 组花卉)`);

            const surfaces = parseSurfaces(island);
            pending.island = { ...surfaces, trees, flowerGroups, snowman, grassMaterials };
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
