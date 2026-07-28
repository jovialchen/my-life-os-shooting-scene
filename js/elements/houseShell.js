/**
 * 外壳房子 + 岛屿地面 —— 从 GLB 模型加载
 * 加载 models/house.glb（房子）与 models/island.glb（岛屿地面 + 四季树）
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { registerDoor } from '../systems/doors.js';

// ── 草地/岛屿参数（花园/栅栏/寻路等模块依赖）──
const GRASS_RADIUS = 25;
const GRASS_CENTER_X = 0;
const GRASS_CENTER_Z = 5; // 公寓中心 z=5

// ── 主函数 ──

/**
 * @param {{ onIslandLoaded?: (info: { trees: Array, leaves: Array, grassMaterials: Array }) => void }} callbacks
 */
export function createHouseShell({ onIslandLoaded } = {}) {
    const house = new THREE.Group();
    house.name = 'houseShell';

    const grass = {
        centerX: GRASS_CENTER_X,
        centerZ: GRASS_CENTER_Z,
        radius: GRASS_RADIUS,
    };

    const loader = new GLTFLoader();

    // ── 异步加载岛屿模型（地面 + 树，替代原平面草地）──
    loader.load(
        './models/island.glb',
        (gltf) => {
            const island = gltf.scene;
            island.name = 'islandModel';

            const trees = [];           // 树干障碍 {x, z, r}
            const leaves = [];          // 四季树叶 mesh（含缩放基点）
            const grassMaterials = [];  // 草顶材质（季节变色目标）
            const box = new THREE.Box3();

            island.traverse((child) => {
                if (!child.isMesh) return;
                child.castShadow = true;
                child.receiveShadow = true;

                // WALK_ 顶面是逻辑行走面，不渲染（寻路系统用）
                if (child.name.startsWith('WALK_')) {
                    child.visible = false;
                    child.castShadow = false;
                    child.receiveShadow = false;
                    return;
                }

                if (child.name.endsWith('_trunk')) {
                    // 树干为圆柱障碍：取世界包围盒水平半径
                    box.setFromObject(child);
                    const r = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2;
                    trees.push({ name: child.name, x: child.position.x, z: child.position.z, r });
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
            onIslandLoaded?.({ trees, leaves, grassMaterials });
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

            // 给所有 mesh 打上 isOccluder 标记（墙体遮挡透明系统用）
            // 带 interactable_type='door' 的门板注册到门交互系统
            model.traverse((child) => {
                if (child.isMesh) {
                    child.userData.isOccluder = true;
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
                if (child.userData.interactable_type === 'door') {
                    registerDoor(child);
                }
            });

            house.add(model);
            console.log('[HouseShell] house.glb loaded');
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
