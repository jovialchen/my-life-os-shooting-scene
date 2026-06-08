/**
 * 家具：圆形矮茶几（三腿金属支架）
 * 放在沙发前方
 */
import * as THREE from 'three';
import { matWood, matMetal } from '../materials.js';

export function createCoffeeTable() {
    const table = new THREE.Group();

    // 圆形桌面
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.05, 32), matWood);
    top.position.y = 0.45;
    top.castShadow = true;
    top.receiveShadow = true;
    table.add(top);

    // 三条腿（均匀分布）
    for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const leg = new THREE.Mesh(
            new THREE.CylinderGeometry(0.03, 0.03, 0.42, 8),
            matMetal
        );
        leg.position.set(Math.cos(a) * 0.35, 0.22, Math.sin(a) * 0.35);
        leg.castShadow = true;
        table.add(leg);
    }

    table.position.set(0.3, 0, 1.5);
    return table;
}
