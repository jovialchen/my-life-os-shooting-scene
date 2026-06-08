/**
 * 窗户 + 窗帘 + 窗台小盆栽
 * 全部挂在右墙上，位置由 ROOM_WIDTH 自动推算
 */
import * as THREE from 'three';
import { ROOM_WIDTH } from '../config.js';
import { matFrame, matGlass, matMetal, matCurtain, matPot, matLeaf } from '../materials.js';

// ── 窗户 ─────────────────────────────────────────────
export function createWindow() {
    const win = new THREE.Group();
    const W = 1.8, H = 2.0, sillH = 0.9;
    const fw = 0.08;

    // 外框
    const outer = new THREE.Mesh(new THREE.BoxGeometry(W + fw * 2, H + fw * 2, fw * 2), matFrame);
    outer.position.y = sillH + H / 2;
    win.add(outer);

    // 玻璃
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(W, H), matGlass);
    glass.position.set(0, sillH + H / 2, 0);
    win.add(glass);

    // 十字窗棂
    const barH = new THREE.Mesh(new THREE.BoxGeometry(W, 0.05, 0.05), matFrame);
    barH.position.y = sillH + H / 2;
    win.add(barH);
    const barV = new THREE.Mesh(new THREE.BoxGeometry(0.05, H, 0.05), matFrame);
    barV.position.y = sillH + H / 2;
    win.add(barV);

    // 窗台
    const sill = new THREE.Mesh(new THREE.BoxGeometry(W + 0.3, 0.06, 0.2), matFrame);
    sill.position.set(0, sillH, 0.08);
    win.add(sill);

    // 挂到右墙
    win.position.set(ROOM_WIDTH / 2 - 0.02, 0, -0.5);
    win.rotation.y = -Math.PI / 2;
    return win;
}

// ── 窗帘 ─────────────────────────────────────────────
export function createCurtains() {
    const group = new THREE.Group();

    [-0.85, 0.85].forEach(xOff => {
        const geo = new THREE.PlaneGeometry(0.7, 2.2, 1, 12);
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            pos.setX(i, pos.getX(i) + Math.sin(pos.getY(i) * 3) * 0.04);
        }
        pos.needsUpdate = true;
        geo.computeVertexNormals();

        const curtain = new THREE.Mesh(geo, matCurtain);
        curtain.position.set(xOff, 1.3, 0);
        curtain.castShadow = true;
        group.add(curtain);
    });

    // 窗帘杆
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.2, 8), matMetal);
    rod.rotation.z = Math.PI / 2;
    rod.position.y = 2.45;
    group.add(rod);

    group.position.set(ROOM_WIDTH / 2 - 0.05, 0, -0.5);
    group.rotation.y = -Math.PI / 2;
    return group;
}

// ── 窗台小盆栽 ───────────────────────────────────────
export function createPlant() {
    const plant = new THREE.Group();

    // 花盆
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.12, 12), matPot);
    pot.position.y = 0.06;
    pot.castShadow = true;
    plant.add(pot);

    // 叶子
    for (let i = 0; i < 5; i++) {
        const leaf = new THREE.Mesh(
            new THREE.SphereGeometry(0.06 + Math.random() * 0.04, 8, 8),
            matLeaf
        );
        const a = (i / 5) * Math.PI * 2;
        leaf.position.set(Math.cos(a) * 0.06, 0.16 + Math.random() * 0.08, Math.sin(a) * 0.06);
        leaf.castShadow = true;
        plant.add(leaf);
    }

    plant.position.set(ROOM_WIDTH / 2 - 0.1, 0.96, 0.3);
    return plant;
}

// ── 体积光雾锥 ───────────────────────────────────────
export function createLightCone() {
    const geo = new THREE.CylinderGeometry(0.1, 1.8, 3.5, 16, 1, true);
    const mat = new THREE.MeshBasicMaterial({
        color: 0xffddaa,
        transparent: true,
        opacity: 0.04,
        side: THREE.DoubleSide,
        depthWrite: false
    });
    const cone = new THREE.Mesh(geo, mat);
    cone.position.set(ROOM_WIDTH / 2 - 1.5, 1.8, -0.5);
    cone.rotation.z = Math.PI / 2 + 0.3;
    return cone;
}
