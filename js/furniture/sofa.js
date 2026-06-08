/**
 * 家具：三人沙发（带靠枕）
 * 左侧靠墙摆放，面朝房间中央
 */
import * as THREE from 'three';
import { matFabric, matFabricA, matWood, matCushion } from '../materials.js';

export function createSofa() {
    const sofa = new THREE.Group();

    // 坐垫底座
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.4, 0.9), matFabric);
    base.position.y = 0.35;
    base.castShadow = true;
    sofa.add(base);

    // 靠背
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.7, 0.15), matFabric);
    back.position.set(0, 0.85, -0.375);
    back.castShadow = true;
    sofa.add(back);

    // 扶手 ×2
    const armGeo = new THREE.BoxGeometry(0.15, 0.5, 0.9);
    [-1.125, 1.125].forEach(x => {
        const arm = new THREE.Mesh(armGeo, matFabric);
        arm.position.set(x, 0.6, 0);
        arm.castShadow = true;
        sofa.add(arm);
    });

    // 腿 ×4
    const legGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.15);
    [[-1, -0.3], [-1, 0.3], [1, -0.3], [1, 0.3]].forEach(([x, z]) => {
        const leg = new THREE.Mesh(legGeo, matWood);
        leg.position.set(x * 1.05, 0.075, z);
        leg.castShadow = true;
        sofa.add(leg);
    });

    // 靠枕 ×2
    const cGeo = new THREE.BoxGeometry(0.4, 0.4, 0.15);
    const c1 = new THREE.Mesh(cGeo, matCushion);
    c1.position.set(-0.7, 0.8, -0.2);
    c1.rotation.z = 0.15;
    sofa.add(c1);

    const c2 = new THREE.Mesh(cGeo, matFabricA);
    c2.position.set(0.7, 0.8, -0.2);
    c2.rotation.z = -0.1;
    sofa.add(c2);

    // 位置：左侧靠墙，面朝中央
    sofa.position.set(-1.5, 0, 0.5);
    sofa.rotation.y = Math.PI / 2;
    return sofa;
}
