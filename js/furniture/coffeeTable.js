/**
 * 家具：圆形矮茶几（三腿金属支架）
 * 放在沙发前方
 */
import * as THREE from 'three';
import { matWood, matMetal } from '../materials.js';

// ── 茶几尺寸 ──────────────────────────────────────────
const D = {
    topRadius: 0.55,       // 桌面半径
    topThick: 0.05,        // 桌面厚度
    topSegments: 32,       // 桌面径向分段
    topY: 0.45,            // 桌面中心 y
    legRadius: 0.03,       // 腿半径
    legHeight: 0.42,       // 腿高度
    legSegments: 8,        // 腿径向分段
    legOrbit: 0.35,        // 腿到中心的径向距离
    legY: 0.22,            // 腿中心 y
    legCount: 3,           // 腿数量
    // 摆放位置
    posX: 0.3,
    posY: 0,
    posZ: 1.5,
};

export function createCoffeeTable() {
    const table = new THREE.Group();

    // 圆形桌面
    const top = new THREE.Mesh(
        new THREE.CylinderGeometry(D.topRadius, D.topRadius, D.topThick, D.topSegments),
        matWood,
    );
    top.position.y = D.topY;
    top.castShadow = true;
    top.receiveShadow = true;
    table.add(top);

    // 三条腿（均匀分布）
    for (let i = 0; i < D.legCount; i++) {
        const a = (i / D.legCount) * Math.PI * 2;
        const leg = new THREE.Mesh(
            new THREE.CylinderGeometry(D.legRadius, D.legRadius, D.legHeight, D.legSegments),
            matMetal,
        );
        leg.position.set(Math.cos(a) * D.legOrbit, D.legY, Math.sin(a) * D.legOrbit);
        leg.castShadow = true;
        table.add(leg);
    }

    table.position.set(D.posX, D.posY, D.posZ);
    return table;
}
