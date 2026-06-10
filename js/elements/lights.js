/**
 * 灯具工厂：顶灯
 *
 * 行为属性（notMovable、toggleType）由 categories.js 统一管理，
 * 工厂只负责构建几何体和设置 lightRef。
 */
import * as THREE from 'three';
import { matMetal, matLampSh } from '../materials.js';

const CEILING_LIGHT = {
    mountRadius: 0.15, mountHeight: 0.03, mountSegments: 24,
    poleRadius: 0.02, poleLength: 0.2, poleSegments: 12,
    shadeRadius: 0.3, shadeHeight: 0.25, shadeSegments: 24,
    bulbColor: 0xffcc77, bulbIntensity: 2.0, bulbDistance: 8,
    bulbShadowMapSize: 512, bulbShadowRadius: 4,
};

/**
 * 创建顶灯
 * @param {object} opts
 * @param {{x,z}} [opts.position] — 水平位置（y 由 roomHeight 决定）
 * @param {number} [opts.roomHeight=3.5] — 房间高度
 * @returns {{ group: THREE.Group, light: THREE.PointLight }}
 */
export function createCeilingLight({ position, roomHeight = 3.5 } = {}) {
    const group = new THREE.Group();
    const D = CEILING_LIGHT;
    const posX = position?.x || 0;
    const posZ = position?.z || 0;

    // 天花板底座
    const mount = new THREE.Mesh(
        new THREE.CylinderGeometry(D.mountRadius, D.mountRadius, D.mountHeight, D.mountSegments),
        matMetal,
    );
    mount.position.set(posX, roomHeight - D.mountHeight / 2, posZ);
    mount.castShadow = true;
    group.add(mount);

    // 连杆
    const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(D.poleRadius, D.poleRadius, D.poleLength, D.poleSegments),
        matMetal,
    );
    pole.position.set(posX, roomHeight - D.mountHeight - D.poleLength / 2, posZ);
    pole.castShadow = true;
    group.add(pole);

    // 灯罩
    const shade = new THREE.Mesh(
        new THREE.ConeGeometry(D.shadeRadius, D.shadeHeight, D.shadeSegments, 1, true),
        matLampSh,
    );
    shade.position.set(posX, roomHeight - D.mountHeight - D.poleLength - D.shadeHeight / 2, posZ);
    shade.castShadow = true;
    group.add(shade);

    // 灯泡光源
    const bulb = new THREE.PointLight(D.bulbColor, D.bulbIntensity, D.bulbDistance);
    bulb.position.set(posX, roomHeight - D.mountHeight - D.poleLength - D.shadeHeight * 0.3, posZ);
    bulb.castShadow = true;
    bulb.shadow.mapSize.set(D.bulbShadowMapSize, D.bulbShadowMapSize);
    bulb.shadow.radius = D.bulbShadowRadius;
    group.add(bulb);

    group.userData.lightRef = bulb;

    return { group, light: bulb };
}
