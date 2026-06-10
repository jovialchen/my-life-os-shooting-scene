/**
 * 家具：圆形边桌（单柱腿 + 圆盘底座）
 * 搭配一本书，放在沙发旁
 * 书作为独立小物品返回，可拖拽放置
 */
import * as THREE from 'three';
import { matWood, matMetal, matBook1 } from '../materials.js';
import { createBook } from './book.js';

// ── 边桌尺寸 ──────────────────────────────────────────
const D = {
    topRadius: 0.3,     // 桌面半径
    topThick: 0.04,     // 桌面厚度
    topSegments: 24,    // 桌面径向分段
    topY: 0.65,         // 桌面中心 y
    legRadius: 0.04,    // 柱腿半径
    legHeight: 0.62,    // 柱腿高度
    legSegments: 8,     // 柱腿径向分段
    legY: 0.32,         // 柱腿中心 y
    footRadius: 0.18,   // 底盘半径
    footThick: 0.03,    // 底盘厚度
    footSegments: 24,   // 底盘径向分段
    footY: 0.015,       // 底盘中心 y
    // 书本尺寸（width=中间边, height=最短边, depth=最长边）
    bookWidth: 0.15,
    bookHeight: 0.06,
    bookDepth: 0.2,
    bookOffsetX: 0.05,  // 书相对桌面中心 x 偏移
    bookOffsetY: 0.7,   // 书 y 偏移（桌面顶部）
    bookRotY: 0.3,      // 书 y 旋转
    // 摆放位置
    posX: -3.0,
    posY: 0,
    posZ: -1.8,
};

export function createSideTable() {
    const table = new THREE.Group();

    // 桌面
    const top = new THREE.Mesh(
        new THREE.CylinderGeometry(D.topRadius, D.topRadius, D.topThick, D.topSegments),
        matWood,
    );
    top.position.y = D.topY;
    top.castShadow = true;
    top.receiveShadow = true;
    table.add(top);

    // 柱腿
    const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(D.legRadius, D.legRadius, D.legHeight, D.legSegments),
        matMetal,
    );
    leg.position.y = D.legY;
    leg.castShadow = true;
    table.add(leg);

    // 底盘
    const foot = new THREE.Mesh(
        new THREE.CylinderGeometry(D.footRadius, D.footRadius, D.footThick, D.footSegments),
        matMetal,
    );
    foot.position.y = D.footY;
    table.add(foot);

    // 书本 — 独立小物品
    const bookGroup = createBook({
        width: D.bookWidth,
        height: D.bookHeight,
        depth: D.bookDepth,
        material: matBook1,
        x: D.posX + D.bookOffsetX,
        y: D.posY + D.bookOffsetY,
        z: D.posZ,
        rotationY: D.bookRotY,
    });

    table.position.set(D.posX, D.posY, D.posZ);
    return { table, book: bookGroup };
}
