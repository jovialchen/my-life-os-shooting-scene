/**
 * 外壳房子 —— 从 GLB 模型加载
 * 加载 models/house.glb，包裹整个场景
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ── 草地参数（花园/栅栏/寻路等模块依赖）──
const GRASS_RADIUS = 25;
const GRASS_CENTER_X = 0;
const GRASS_CENTER_Z = 5; // 公寓中心 z=5

// ── 主函数 ──

export function createHouseShell() {
    const house = new THREE.Group();
    house.name = 'houseShell';

    // ── 绿色草地圆（同步创建，花园/季节系统需要）──
    const grassMesh = new THREE.Mesh(
        new THREE.CircleGeometry(GRASS_RADIUS, 64),
        new THREE.MeshStandardMaterial({ color: 0x7a9e6d, roughness: 1.0 }),
    );
    grassMesh.rotation.x = -Math.PI / 2;
    grassMesh.position.set(GRASS_CENTER_X, -0.02, GRASS_CENTER_Z);
    grassMesh.receiveShadow = true;
    house.add(grassMesh);

    const grass = {
        centerX: GRASS_CENTER_X,
        centerZ: GRASS_CENTER_Z,
        radius: GRASS_RADIUS,
    };

    // ── 异步加载 GLB 房子模型 ──
    const loader = new GLTFLoader();
    loader.load(
        './models/house.glb',
        (gltf) => {
            const model = gltf.scene;
            model.name = 'houseModel';

            // 给所有 mesh 打上 isOccluder 标记（墙体遮挡透明系统用）
            model.traverse((child) => {
                if (child.isMesh) {
                    child.userData.isOccluder = true;
                    child.castShadow = true;
                    child.receiveShadow = true;
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
        door: null,          // GLB 模型的门不是交互式的
        grass,
        grassMesh,
    };
}
