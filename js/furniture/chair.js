/**
 * 家具：单人椅
 * 放在沙发斜对面，微微侧转
 */
import * as THREE from 'three';
import { matFabricA, matWood } from '../materials.js';

export function createChair() {
    const chair = new THREE.Group();

    // 坐面
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 0.55), matFabricA);
    seat.position.y = 0.5;
    seat.castShadow = true;
    chair.add(seat);

    // 靠背
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.06), matFabricA);
    back.position.set(0, 0.83, -0.245);
    back.castShadow = true;
    chair.add(back);

    // 腿 ×4
    const legGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.47);
    [[-0.25, -0.2], [-0.25, 0.2], [0.25, -0.2], [0.25, 0.2]].forEach(([x, z]) => {
        const leg = new THREE.Mesh(legGeo, matWood);
        leg.position.set(x, 0.235, z);
        leg.castShadow = true;
        chair.add(leg);
    });

    // 位置：右侧偏前，微微侧转
    chair.position.set(1.8, 0, 1.2);
    chair.rotation.y = -Math.PI / 4;
    return chair;
}
