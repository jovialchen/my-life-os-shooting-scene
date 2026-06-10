/**
 * 家具：三层书架（含随机书本）
 * 书本作为独立小物品返回，可拖拽放置
 * 靠东墙摆放（远离窗户）
 */
import * as THREE from 'three';
import { matWood, matWall, matBook1, matBook2, matBook3 } from '../materials.js';
import { createBook } from './book.js';

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
    // 摆放位置（靠东墙，远离窗户）
    posX: -3.625,   // -ROOM_WIDTH/2 + depth/2 + wallOffset = -4 + 0.175 + 0.2
    posY: 0,
    posZ: 0,
};

export function createBookshelf() {
    const shelf = new THREE.Group();
    const books = [];

    const shelfPos = { x: D.posX, y: D.posY, z: D.posZ ?? 0 };

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
    // 书架已旋转 90°（rotation.y = π/2），书本坐标需相应变换：
    //   局部 x → 世界 -z,  局部 z → 世界 x
    const bookMats = [matBook1, matBook2, matBook3];
    for (let row = 0; row < D.shelfCount; row++) {
        const y = row * (D.height / D.shelfCount) + D.plankThick + D.bookYOffset;
        const count = D.bookMinCount + Math.floor(Math.random() * D.bookRandomCount);
        let localX = -D.width / 2 + D.bookStartX;
        for (let b = 0; b < count; b++) {
            const bw = D.bookMinWidth + Math.random() * D.bookRandomWidth;
            const bh = D.bookMinHeight + Math.random() * D.bookRandomHeight;
            // width=第二长边(D.bookDepth), height=最短边(bw), depth=最长边(bh)
            // rotation.x=0 时平躺, π/2 时站立 → 书架书初始 π/2（站立）
            // 旋转后：世界 x = shelfPos.x, 世界 z = shelfPos.z - (localX + bw/2)
            books.push(createBook({
                width: D.bookDepth,
                height: bw,
                depth: bh,
                material: bookMats[b % 3],
                x: shelfPos.x,
                y: shelfPos.y + y + bh / 2,
                z: shelfPos.z - (localX + bw / 2),
                rotationX: Math.PI / 2,
            }));
            localX += bw + D.bookGap;
        }
    }

    // 靠东墙：旋转 90° 使背面朝向墙壁
    shelf.rotation.y = Math.PI / 2;
    shelf.position.set(shelfPos.x, shelfPos.y, shelfPos.z);
    return { shelf, books };
}
