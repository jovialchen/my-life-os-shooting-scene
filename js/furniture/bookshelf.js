/**
 * 家具：三层书架（含随机书本）
 * 书本作为独立小物品返回，可拖拽放置
 * 靠后墙摆放
 */
import * as THREE from 'three';
import { ROOM_DEPTH } from '../config.js';
import { matWood, matWall, matBook1, matBook2, matBook3 } from '../materials.js';

export function createBookshelf() {
    const shelf = new THREE.Group();
    const books = [];
    const w = 1.2, h = 2.0, d = 0.35, t = 0.04;

    const shelfPos = { x: 1.0, y: 0, z: -ROOM_DEPTH / 2 + 0.2 };

    // 侧板 ×2
    [-1, 1].forEach(side => {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(t, h, d), matWood);
        panel.position.set(side * (w / 2), h / 2, 0);
        panel.castShadow = true;
        shelf.add(panel);
    });

    // 层板 ×4（含顶板）
    for (let i = 0; i <= 3; i++) {
        const plank = new THREE.Mesh(new THREE.BoxGeometry(w, t, d), matWood);
        plank.position.y = i * (h / 3) + t / 2;
        plank.receiveShadow = true;
        plank.castShadow = true;
        shelf.add(plank);
    }

    // 背板
    const backPanel = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.02), matWall);
    backPanel.position.set(0, h / 2, -d / 2 + 0.01);
    shelf.add(backPanel);

    // 随机书本（每层 3~5 本）— 作为独立 Group 返回，位置转为世界坐标
    const bookMats = [matBook1, matBook2, matBook3];
    for (let row = 0; row < 3; row++) {
        const y = row * (h / 3) + t + 0.04;
        const count = 3 + Math.floor(Math.random() * 3);
        let x = -w / 2 + 0.12;
        for (let b = 0; b < count; b++) {
            const bw = 0.06 + Math.random() * 0.06;
            const bh = 0.2 + Math.random() * 0.1;
            const bookGroup = new THREE.Group();
            const bookMesh = new THREE.Mesh(
                new THREE.BoxGeometry(bw, bh, 0.18),
                bookMats[b % 3]
            );
            bookMesh.castShadow = true;
            bookGroup.add(bookMesh);
            // 世界坐标 = 书架位置 + 本地偏移
            bookGroup.position.set(
                shelfPos.x + x + bw / 2,
                shelfPos.y + y + bh / 2,
                shelfPos.z
            );
            books.push(bookGroup);
            x += bw + 0.01;
        }
    }

    shelf.position.set(shelfPos.x, shelfPos.y, shelfPos.z);
    return { shelf, books };
}
