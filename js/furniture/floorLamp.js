/**
 * 家具：落地灯（自带暖色点光源）
 * 放在书架旁，提供局部照明
 */
import * as THREE from 'three';
import { matMetal, matLampSh } from '../materials.js';

// ── 落地灯尺寸 ────────────────────────────────────────
const D = {
    baseTopRadius: 0.2,     // 底座顶部半径
    baseBottomRadius: 0.22, // 底座底部半径
    baseHeight: 0.04,       // 底座高度
    baseSegments: 24,       // 底座径向分段
    baseY: 0.02,            // 底座中心 y
    poleRadius: 0.03,       // 灯杆半径
    poleHeight: 1.7,        // 灯杆高度
    poleSegments: 12,       // 灯杆径向分段
    poleY: 0.89,            // 灯杆中心 y
    shadeRadius: 0.25,      // 灯罩半径
    shadeHeight: 0.35,      // 灯罩高度
    shadeSegments: 24,      // 灯罩径向分段
    shadeY: 1.85,           // 灯罩中心 y
    // 灯泡光源
    bulbColor: 0xffcc77,    // 暖黄色
    bulbIntensity: 1.5,
    bulbDistance: 6,
    bulbY: 1.75,            // 灯泡 y
    bulbShadowMapSize: 512,
    bulbShadowRadius: 4,
    // 摆放位置
    posX: 2.5,
    posY: 0,
    posZ: -1.5,
};

export function createFloorLamp() {
    const lamp = new THREE.Group();

    // 底座
    const base = new THREE.Mesh(
        new THREE.CylinderGeometry(D.baseTopRadius, D.baseBottomRadius, D.baseHeight, D.baseSegments),
        matMetal,
    );
    base.position.y = D.baseY;
    base.castShadow = true;
    lamp.add(base);

    // 灯杆
    const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(D.poleRadius, D.poleRadius, D.poleHeight, D.poleSegments),
        matMetal,
    );
    pole.position.y = D.poleY;
    pole.castShadow = true;
    lamp.add(pole);

    // 灯罩
    const shade = new THREE.Mesh(
        new THREE.ConeGeometry(D.shadeRadius, D.shadeHeight, D.shadeSegments, 1, true),
        matLampSh,
    );
    shade.position.y = D.shadeY;
    shade.castShadow = true;
    lamp.add(shade);

    // 灯泡光源
    const bulb = new THREE.PointLight(D.bulbColor, D.bulbIntensity, D.bulbDistance);
    bulb.position.y = D.bulbY;
    bulb.castShadow = true;
    bulb.shadow.mapSize.set(D.bulbShadowMapSize, D.bulbShadowMapSize);
    bulb.shadow.radius = D.bulbShadowRadius;
    lamp.add(bulb);

    lamp.position.set(D.posX, D.posY, D.posZ);
    return lamp;
}
