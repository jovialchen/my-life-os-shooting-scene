/**
 * 家具：落地灯（自带暖色点光源）
 * 放在书架旁，提供局部照明
 */
import * as THREE from 'three';
import { matMetal, matLampSh } from '../materials.js';

export function createFloorLamp() {
    const lamp = new THREE.Group();

    // 底座
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.04, 24), matMetal);
    base.position.y = 0.02;
    base.castShadow = true;
    lamp.add(base);

    // 灯杆
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.7, 12), matMetal);
    pole.position.y = 0.89;
    pole.castShadow = true;
    lamp.add(pole);

    // 灯罩
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.35, 24, 1, true), matLampSh);
    shade.position.y = 1.85;
    shade.castShadow = true;
    lamp.add(shade);

    // 灯泡光源
    const bulb = new THREE.PointLight(0xffcc77, 1.5, 6);
    bulb.position.y = 1.75;
    bulb.castShadow = true;
    bulb.shadow.mapSize.set(512, 512);
    bulb.shadow.radius = 4;
    lamp.add(bulb);

    lamp.position.set(2.5, 0, -1.5);
    return lamp;
}
