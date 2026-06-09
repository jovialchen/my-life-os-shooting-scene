/**
 * 角色：VRM 动漫角色加载器
 * 加载 jo.vrm 模型
 * 如果 MToon 着色器编译失败，自动回退到标准材质
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin } from '@pixiv/three-vrm';

// ── 角色摆放参数 ──────────────────────────────────────
const VRM = {
    posX: 1.5,          // x 位置
    posY: 0,            // y 位置
    posZ: 0.3,          // z 位置
    rotY: -0.4,         // y 旋转（弧度）
    fallbackColor: 0xffffff, // 回退材质颜色
};

export function createHumanoid() {
    const group = new THREE.Group();

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    loader.load(
        './jo.vrm',
        (gltf) => {
            const vrm = gltf.userData.vrm;
            if (!vrm) {
                console.error('VRM: gltf.userData.vrm is undefined');
                return;
            }

            // 开启阴影 + MToon 着色器失败时回退到标准材质
            gltf.scene.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;

                    // 检测 ShaderMaterial（MToon），替换为 MeshStandardMaterial
                    if (child.material && child.material.type === 'ShaderMaterial') {
                        const m = child.material;
                        const color = m.color || new THREE.Color(VRM.fallbackColor);
                        const map = m.map || null;
                        const fallback = new THREE.MeshStandardMaterial({
                            color,
                            map,
                            side: m.side ?? THREE.FrontSide,
                            transparent: m.transparent ?? false,
                            opacity: m.opacity ?? 1.0,
                            alphaTest: m.alphaTest ?? 0,
                        });
                        child.material = fallback;
                        console.log('MToon → Standard fallback:', child.name);
                    }
                }
            });

            // 调整位置和朝向
            vrm.scene.position.set(VRM.posX, VRM.posY, VRM.posZ);
            vrm.scene.rotation.y = VRM.rotY;

            group.add(vrm.scene);
            console.log('VRM loaded:', vrm.meta?.name);
        },
        (progress) => {
            const pct = progress.total ? Math.round((progress.loaded / progress.total) * 100) : '?';
            console.log(`VRM loading: ${pct}%`);
        },
        (error) => {
            console.error('VRM load error:', error);
        }
    );

    return group;
}
