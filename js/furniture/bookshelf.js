/**
 * 家具：三层书架（含随机书本）
 * 书本作为独立小物品返回，可拖拽放置
 * 靠后墙摆放
 */
import * as THREE from 'three';
import { ROOM_DEPTH } from '../config.js';
import { matWood, matWall, matBook1, matBook2, matBook3 } from '../materials.js';

// ── 书架尺寸 ──────────────────────────────────────────
const D = {
    width: 1.2,          // 书架宽度
    height: 2.0,         // 书架高度
    depth: 0.35,         // 书架深度
    plankThick: 0.04,    // 层板/侧板厚度
    shelfCount: 3,       // 层数
    backThick: 0.02,     // 背板厚度
    backOffset: 0.01,    // 背板 z 偏移
    wallOffset: 0.2,     // 离后墙距离
    // 书本参数
    bookMinCount: 3,        // 每层最少书本数
    bookRandomCount: 3,     // 随机书本数范围 (0~3)
    bookStartX: 0.12,       // 起始 x 偏移
    bookMinWidth: 0.06,     // 书本最小宽度
    bookRandomWidth: 0.06,  // 书本随机宽度范围
    bookMinHeight: 0.2,     // 书本最小高度
    bookRandomHeight: 0.1,  // 书本随机高度范围
    bookDepth: 0.18,        // 书本深度
    bookGap: 0.01,          // 书本间距
    bookYOffset: 0.04,      // 书本 y 偏移（层板顶部）
    // 摆放位置
    posX: 1.0,
    posY: 0,
};

export function createBookshelf() {
    const shelf = new THREE.Group();
    const books = [];

    const shelfPos = { x: D.posX, y: D.posY, z: -ROOM_DEPTH / 2 + D.wallOffset };

    // 侧板 ×2
    [-1, 1].forEach(side => {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(D.plankThick, D.height, D.depth), matWood);
        panel.position.set(side * (D.width / 2), D.height / 2, 0);
        panel.castShadow = true;
        shelf.add(panel);
    });

    // 层板 ×4（含顶板）
    for (let i = 0; i <= D.shelfCount; i++) {
        const plank = new THREE.Mesh(new THREE.BoxGeometry(D.width, D.plankThick, D.depth), matWood);
        plank.position.y = i * (D.height / D.shelfCount) + D.plankThick / 2;
        plank.receiveShadow = true;
        plank.castShadow = true;
        shelf.add(plank);
    }

    // 背板
    const backPanel = new THREE.Mesh(new THREE.BoxGeometry(D.width, D.height, D.backThick), matWall);
    backPanel.position.set(0, D.height / 2, -D.depth / 2 + D.backOffset);
    shelf.add(backPanel);

    // 随机书本（每层 3~5 本）— 作为独立 Group 返回，位置转为世界坐标
    const bookMats = [matBook1, matBook2, matBook3];
    for (let row = 0; row < D.shelfCount; row++) {
        const y = row * (D.height / D.shelfCount) + D.plankThick + D.bookYOffset;
        const count = D.bookMinCount + Math.floor(Math.random() * D.bookRandomCount);
        let x = -D.width / 2 + D.bookStartX;
        for (let b = 0; b < count; b++) {
            const bw = D.bookMinWidth + Math.random() * D.bookRandomWidth;
            const bh = D.bookMinHeight + Math.random() * D.bookRandomHeight;
            const bookGroup = new THREE.Group();
            const bookMesh = new THREE.Mesh(
                new THREE.BoxGeometry(bw, bh, D.bookDepth),
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
            x += bw + D.bookGap;
        }
    }

    shelf.position.set(shelfPos.x, shelfPos.y, shelfPos.z);
    return { shelf, books };
}
