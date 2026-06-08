/**
 * 家具：三层书架（含随机书本）
 * 靠后墙摆放
 */
import * as THREE from 'three';
import { ROOM_DEPTH } from '../config.js';
import { matWood, matWall, matBook1, matBook2, matBook3 } from '../materials.js';

export function createBookshelf() {
    const shelf = new THREE.Group();
    const w = 1.2, h = 2.0, d = 0.35, t = 0.04;

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

    // 随机书本（每层 3~5 本）
    const bookMats = [matBook1, matBook2, matBook3];
    for (let row = 0; row < 3; row++) {
        const y = row * (h / 3) + t + 0.04;
        const count = 3 + Math.floor(Math.random() * 3);
        let x = -w / 2 + 0.12;
        for (let b = 0; b < count; b++) {
            const bw = 0.06 + Math.random() * 0.06;
            const bh = 0.2 + Math.random() * 0.1;
            const book = new THREE.Mesh(
                new THREE.BoxGeometry(bw, bh, 0.18),
                bookMats[b % 3]
            );
            book.position.set(x + bw / 2, y + bh / 2, 0);
            book.castShadow = true;
            shelf.add(book);
            x += bw + 0.01;
        }
    }

    // 靠后墙
    shelf.position.set(1.0, 0, -ROOM_DEPTH / 2 + 0.2);
    return shelf;
}
