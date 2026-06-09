/**
 * 家具：顶灯（天花板吊灯，自带暖色点光源）
 * 固定在天花板中央，不可移动，可点击开关
 */
import * as THREE from 'three';
import { ROOM_HEIGHT } from '../config.js';
import { matMetal, matLampSh } from '../materials.js';

// ── 顶灯尺寸 ────────────────────────────────────────
const D = {
    mountRadius: 0.15,      // 天花板底座半径
    mountHeight: 0.03,      // 天花板底座高度
    mountSegments: 24,
    poleRadius: 0.02,       // 连杆半径
    poleLength: 0.2,        // 连杆长度
    poleSegments: 12,
    shadeRadius: 0.3,       // 灯罩底部半径（开口端）
    shadeHeight: 0.25,      // 灯罩高度
    shadeSegments: 24,
    // 灯泡光源
    bulbColor: 0xffcc77,    // 暖黄色
    bulbIntensity: 2.0,
    bulbDistance: 8,
    bulbShadowMapSize: 512,
    bulbShadowRadius: 4,
    // 摆放位置（天花板中央）
    posX: 0,
    posY: ROOM_HEIGHT,      // 贴在天花板
    posZ: 0,
};

export function createCeilingLight() {
    const group = new THREE.Group();

    // 天花板底座（圆形贴片）
    const mount = new THREE.Mesh(
        new THREE.CylinderGeometry(D.mountRadius, D.mountRadius, D.mountHeight, D.mountSegments),
        matMetal,
    );
    mount.position.y = D.posY - D.mountHeight / 2;
    mount.castShadow = true;
    group.add(mount);

    // 连杆（从天花板向下延伸）
    const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(D.poleRadius, D.poleRadius, D.poleLength, D.poleSegments),
        matMetal,
    );
    pole.position.y = D.posY - D.mountHeight - D.poleLength / 2;
    pole.castShadow = true;
    group.add(pole);

    // 灯罩（倒锥形，开口朝上）
    const shade = new THREE.Mesh(
        new THREE.ConeGeometry(D.shadeRadius, D.shadeHeight, D.shadeSegments, 1, true),
        matLampSh,
    );
    shade.position.y = D.posY - D.mountHeight - D.poleLength - D.shadeHeight / 2;
    shade.castShadow = true;
    group.add(shade);

    // 灯泡光源
    const bulb = new THREE.PointLight(D.bulbColor, D.bulbIntensity, D.bulbDistance);
    bulb.position.y = D.posY - D.mountHeight - D.poleLength - D.shadeHeight * 0.3;
    bulb.castShadow = true;
    bulb.shadow.mapSize.set(D.bulbShadowMapSize, D.bulbShadowMapSize);
    bulb.shadow.radius = D.bulbShadowRadius;
    group.add(bulb);

    // 标记：不可移动
    group.userData.notMovable = true;

    return { group, light: bulb };
}
