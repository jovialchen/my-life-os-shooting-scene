/**
 * 家具：单人椅
 * 放在沙发斜对面，微微侧转
 */
import * as THREE from 'three';
import { matFabricA, matWood } from '../materials.js';

// ── 椅子尺寸 ──────────────────────────────────────────
export const D = {
    seatWidth: 0.6,     // 坐面宽度
    seatThick: 0.06,    // 坐面厚度
    seatDepth: 0.55,    // 坐面深度
    seatY: 0.5,         // 坐面中心 y
    backHeight: 0.6,    // 靠背高度
    backThick: 0.06,    // 靠背厚度
    backY: 0.83,        // 靠背中心 y
    backZ: -0.245,      // 靠背 z 偏移
    legRadius: 0.03,    // 腿半径
    legHeight: 0.47,    // 腿高度
    legX: 0.25,         // 腿 x 偏移（左右对称）
    legZ: 0.2,          // 腿 z 偏移（前后对称）
    legY: 0.235,        // 腿中心 y
    // 摆放位置
    posX: 1.8,
    posY: 0,
    posZ: 1.2,
};

export function createChair() {
    const chair = new THREE.Group();

    // 坐面
    const seat = new THREE.Mesh(new THREE.BoxGeometry(D.seatWidth, D.seatThick, D.seatDepth), matFabricA);
    seat.position.y = D.seatY;
    seat.castShadow = true;
    chair.add(seat);

    // 靠背
    const back = new THREE.Mesh(new THREE.BoxGeometry(D.seatWidth, D.backHeight, D.backThick), matFabricA);
    back.position.set(0, D.backY, D.backZ);
    back.castShadow = true;
    chair.add(back);

    // 腿 ×4
    const legGeo = new THREE.CylinderGeometry(D.legRadius, D.legRadius, D.legHeight);
    [[-D.legX, -D.legZ], [-D.legX, D.legZ], [D.legX, -D.legZ], [D.legX, D.legZ]].forEach(([x, z]) => {
        const leg = new THREE.Mesh(legGeo, matWood);
        leg.position.set(x, D.legY, z);
        leg.castShadow = true;
        chair.add(leg);
    });

    // 位置：右侧偏前，微微侧转
    chair.position.set(D.posX, D.posY, D.posZ);
    chair.rotation.y = -Math.PI / 4;
    return chair;
}

/** 计算椅子可放置表面（坐面，旋转 -45° 后的包围盒） */
export function computeSurfaces() {
    const seatTop = D.seatY + D.seatThick / 2;
    // 旋转 -45° 后的坐面包围盒
    const cos45 = Math.SQRT1_2; // cos(45°) = sin(45°) = √2/2
    const halfX = (D.seatWidth * cos45 + D.seatDepth * cos45) / 2;
    const halfZ = halfX; // 正方形旋转后仍对称
    return [{
        minX: D.posX - halfX,
        maxX: D.posX + halfX,
        minZ: D.posZ - halfZ,
        maxZ: D.posZ + halfZ,
        height: seatTop,
    }];
}
