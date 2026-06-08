/**
 * 房间装饰：地毯 + 墙面装饰画
 */
import * as THREE from 'three';
import { ROOM_WIDTH, ROOM_DEPTH } from '../config.js';
import { matRug, matFrame } from '../materials.js';

// ── 地毯 ─────────────────────────────────────────────
export function createRug() {
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 2.8), matRug);
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0, 0.005, 0.5);
    rug.receiveShadow = true;
    return rug;
}

// ── 墙面装饰画（挂左墙） ─────────────────────────────
export function createWallArt() {
    const art = new THREE.Group();

    // 画框
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.65, 0.04), matFrame);
    frame.castShadow = true;
    art.add(frame);

    // 画布底色
    const canvas = new THREE.Mesh(
        new THREE.PlaneGeometry(0.78, 0.53),
        new THREE.MeshStandardMaterial({ color: 0xc2956b, roughness: 0.85 })
    );
    canvas.position.z = 0.025;
    art.add(canvas);

    // 四色装饰块
    const colors = [0xdaa520, 0xcd853f, 0xa0522d, 0xf4a460];
    colors.forEach((c, i) => {
        const block = new THREE.Mesh(
            new THREE.PlaneGeometry(0.35, 0.22),
            new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 })
        );
        block.position.set((i % 2 - 0.5) * 0.36, i < 2 ? 0.13 : -0.13, 0.026);
        art.add(block);
    });

    // 挂到左墙
    art.position.set(-ROOM_WIDTH / 2 + 0.03, 2.0, -1.0);
    art.rotation.y = Math.PI / 2;
    return art;
}
