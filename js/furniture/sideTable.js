/**
 * 家具：圆形边桌（单柱腿 + 圆盘底座）
 * 搭配一本书，放在沙发旁
 * 书作为独立小物品返回，可拖拽放置
 */
import * as THREE from 'three';
import { matWood, matMetal, matBook1 } from '../materials.js';

export function createSideTable() {
    const table = new THREE.Group();
    const tablePos = { x: -3.0, y: 0, z: -1.8 };

    // 桌面
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 24), matWood);
    top.position.y = 0.65;
    top.castShadow = true;
    top.receiveShadow = true;
    table.add(top);

    // 柱腿
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.62, 8), matMetal);
    leg.position.y = 0.32;
    leg.castShadow = true;
    table.add(leg);

    // 底盘
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.03, 24), matMetal);
    foot.position.y = 0.015;
    table.add(foot);

    // 书本 — 独立小物品
    const bookGroup = new THREE.Group();
    const bookMesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.15), matBook1);
    bookMesh.castShadow = true;
    bookGroup.add(bookMesh);
    bookGroup.position.set(tablePos.x + 0.05, tablePos.y + 0.7, tablePos.z);
    bookGroup.rotation.y = 0.3;

    table.position.set(tablePos.x, tablePos.y, tablePos.z);
    return { table, book: bookGroup };
}
