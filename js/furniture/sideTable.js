/**
 * 家具：圆形边桌（单柱腿 + 圆盘底座）
 * 搭配一本书，放在沙发旁
 */
import * as THREE from 'three';
import { matWood, matMetal, matBook1 } from '../materials.js';

export function createSideTable() {
    const table = new THREE.Group();

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

    // 书本
    const book = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.15), matBook1);
    book.position.set(0.05, 0.7, 0);
    book.rotation.y = 0.3;
    book.castShadow = true;
    table.add(book);

    table.position.set(-3.0, 0, -1.8);
    return table;
}
