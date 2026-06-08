/**
 * 角色：简单人形（立方体 + 球体 + 圆柱拼凑）
 * 无动画，站在原地即可
 */
import * as THREE from 'three';
import { matWhite, matPant, matSkin, matHair, matShoe, matEye } from '../materials.js';

export function createHumanoid() {
    const person = new THREE.Group();

    // ── 躯干 ──
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.6, 0.25), matWhite);
    torso.position.y = 1.15;
    torso.castShadow = true;
    person.add(torso);

    // ── 头 ──
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 24, 24), matSkin);
    head.position.y = 1.63;
    head.castShadow = true;
    person.add(head);

    // 头发（上半球）
    const hair = new THREE.Mesh(
        new THREE.SphereGeometry(0.19, 24, 24, 0, Math.PI * 2, 0, Math.PI * 0.6),
        matHair
    );
    hair.position.y = 1.66;
    person.add(hair);

    // 眼睛 ×2
    const eyeGeo = new THREE.SphereGeometry(0.025, 12, 12);
    [-0.065, 0.065].forEach(x => {
        const eye = new THREE.Mesh(eyeGeo, matEye);
        eye.position.set(x, 1.65, 0.15);
        person.add(eye);
    });

    // ── 腿 ×2 ──
    const legGeo = new THREE.CylinderGeometry(0.07, 0.06, 0.7, 12);
    [-0.1, 0.1].forEach(x => {
        const leg = new THREE.Mesh(legGeo, matPant);
        leg.position.set(x, 0.5, 0);
        leg.castShadow = true;
        person.add(leg);

        // 鞋
        const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.18), matShoe);
        shoe.position.set(x, 0.03, 0.03);
        shoe.castShadow = true;
        person.add(shoe);
    });

    // ── 手臂 ×2 ──
    const armGeo = new THREE.CylinderGeometry(0.05, 0.04, 0.55, 12);
    [-0.3, 0.3].forEach(x => {
        const arm = new THREE.Mesh(armGeo, matSkin);
        arm.position.set(x, 1.05, 0);
        arm.rotation.z = x < 0 ? 0.12 : -0.12;
        arm.castShadow = true;
        person.add(arm);
    });

    // 站在房间右侧，微微侧身
    person.position.set(1.5, 0, 0.3);
    person.rotation.y = -0.4;
    return person;
}
