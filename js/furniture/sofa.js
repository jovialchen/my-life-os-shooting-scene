/**
 * 家具：三人沙发（带靠枕）
 * 左侧靠墙摆放，面朝房间中央
 */
import * as THREE from 'three';
import { matFabric, matFabricA, matWood, matCushion } from '../materials.js';

// ── 沙发尺寸 ──────────────────────────────────────────
export const D = {
    width: 2.4,      // 沙发总宽
    depth: 0.9,      // 沙发总深
    baseHeight: 0.4,  // 坐垫底座高度
    baseY: 0.35,      // 底座中心 y
    backHeight: 0.7,  // 靠背高度
    backThick: 0.15,  // 靠背厚度
    backY: 0.85,      // 靠背中心 y
    backZ: -0.375,    // 靠背 z 偏移
    armWidth: 0.15,   // 扶手宽度
    armHeight: 0.5,   // 扶手高度
    armY: 0.6,        // 扶手中心 y
    armX: 1.125,      // 扶手 x 偏移（左右对称）
    legRadius: 0.04,  // 腿半径
    legHeight: 0.15,  // 腿高度
    legScaleX: 1.05,  // 腿 x 缩放
    legY: 0.075,      // 腿中心 y
    legX: 1.0,        // 腿 x 偏移基础值
    legZ: 0.3,        // 腿 z 偏移
    cushionSize: 0.4, // 靠枕宽高
    cushionDepth: 0.15, // 靠枕厚度
    cushionY: 0.8,    // 靠枕 y
    cushionZ: -0.2,   // 靠枕 z 偏移
    cushionLeftX: -0.7,  // 左靠枕 x
    cushionRightX: 0.7,  // 右靠枕 x
    cushionRotL: 0.15,   // 左靠枕 z 旋转
    cushionRotR: -0.1,   // 右靠枕 z 旋转
    // 摆放位置
    posX: -1.5,
    posY: 0,
    posZ: 0.5,
};

export function createSofa() {
    const sofa = new THREE.Group();

    // 坐垫底座
    const base = new THREE.Mesh(new THREE.BoxGeometry(D.width, D.baseHeight, D.depth), matFabric);
    base.position.y = D.baseY;
    base.castShadow = true;
    sofa.add(base);

    // 靠背
    const back = new THREE.Mesh(new THREE.BoxGeometry(D.width, D.backHeight, D.backThick), matFabric);
    back.position.set(0, D.backY, D.backZ);
    back.castShadow = true;
    sofa.add(back);

    // 扶手 ×2
    const armGeo = new THREE.BoxGeometry(D.armWidth, D.armHeight, D.depth);
    [-D.armX, D.armX].forEach(x => {
        const arm = new THREE.Mesh(armGeo, matFabric);
        arm.position.set(x, D.armY, 0);
        arm.castShadow = true;
        sofa.add(arm);
    });

    // 腿 ×4
    const legGeo = new THREE.CylinderGeometry(D.legRadius, D.legRadius, D.legHeight);
    [[-D.legX, -D.legZ], [-D.legX, D.legZ], [D.legX, -D.legZ], [D.legX, D.legZ]].forEach(([x, z]) => {
        const leg = new THREE.Mesh(legGeo, matWood);
        leg.position.set(x * D.legScaleX, D.legY, z);
        leg.castShadow = true;
        sofa.add(leg);
    });

    // 靠枕 ×2
    const cGeo = new THREE.BoxGeometry(D.cushionSize, D.cushionSize, D.cushionDepth);
    const c1 = new THREE.Mesh(cGeo, matCushion);
    c1.position.set(D.cushionLeftX, D.cushionY, D.cushionZ);
    c1.rotation.z = D.cushionRotL;
    sofa.add(c1);

    const c2 = new THREE.Mesh(cGeo, matFabricA);
    c2.position.set(D.cushionRightX, D.cushionY, D.cushionZ);
    c2.rotation.z = D.cushionRotR;
    sofa.add(c2);

    // 位置：左侧靠墙，面朝中央
    sofa.position.set(D.posX, D.posY, D.posZ);
    sofa.rotation.y = Math.PI / 2;
    return sofa;
}

/** 计算沙发可放置表面（坐面，旋转 90° 后宽深互换） */
export function computeSurfaces() {
    const seatTop = D.baseY + D.baseHeight / 2;
    // 旋转 90° 后：本地 width → 世界 z，本地 depth → 世界 x
    return [{
        minX: D.posX - D.depth / 2,
        maxX: D.posX + D.depth / 2,
        minZ: D.posZ - D.width / 2,
        maxZ: D.posZ + D.width / 2,
        height: seatTop,
    }];
}
