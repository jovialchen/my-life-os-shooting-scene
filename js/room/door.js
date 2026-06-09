/**
 * 门：门框 + 门板 + 门把手
 * 挂在北墙（前墙 z=+ROOM_DEPTH/2），门板可点击开合
 */
import * as THREE from 'three';
import { ROOM_DEPTH, DOOR_WIDTH, DOOR_HEIGHT } from '../config.js';
import { matFrame, matWood, matMetal } from '../materials.js';

// ── 门框尺寸 ──────────────────────────────────────────
const FRAME = {
    thick: 0.06,      // 门框截面宽度
    depth: 0.08,      // 门框厚度（z 方向）
};

// ── 门板尺寸 ──────────────────────────────────────────
const DOOR = {
    width:  DOOR_WIDTH - 0.05,   // 比门洞窄一点，留缝隙
    height: DOOR_HEIGHT - 0.03,
    thick:  0.04,
};

// ── 门把手 ──────────────────────────────────────────
const HANDLE = {
    radius: 0.02,
    length: 0.12,
    posX:   DOOR.width / 2 - 0.08, // 靠近门的开合侧
    posY:   DOOR.height / 2
};

export function createDoor() {
    const group = new THREE.Group();

    // ── 门框（三条边：上 + 左 + 右） ───────────────────
    const ft = FRAME.thick;
    const fd = FRAME.depth;

    // 上框
    const topBar = new THREE.Mesh(new THREE.BoxGeometry(DOOR_WIDTH + ft * 2, ft, fd), matFrame);
    topBar.position.set(0, DOOR_HEIGHT + ft / 2, 0);
    group.add(topBar);

    // 左框
    const leftBar = new THREE.Mesh(new THREE.BoxGeometry(ft, DOOR_HEIGHT + ft, fd), matFrame);
    leftBar.position.set(-DOOR_WIDTH / 2 - ft / 2, DOOR_HEIGHT / 2, 0);
    group.add(leftBar);

    // 右框
    const rightBar = new THREE.Mesh(new THREE.BoxGeometry(ft, DOOR_HEIGHT + ft, fd), matFrame);
    rightBar.position.set(DOOR_WIDTH / 2 + ft / 2, DOOR_HEIGHT / 2, 0);
    group.add(rightBar);

    // ── 门板（绕左侧边旋转） ───────────────────────────
    // 用 pivot group 实现绕左边缘旋转
    const doorPivot = new THREE.Group();
    doorPivot.position.set(-DOOR_WIDTH / 2, 0, 0); // pivot 在门洞左边缘

    const doorPanel = new THREE.Mesh(
        new THREE.BoxGeometry(DOOR.width, DOOR.height, DOOR.thick),
        matWood,
    );
    // 门板中心相对 pivot 偏移（门板左边缘对齐 pivot）
    doorPanel.position.set(DOOR.width / 2, DOOR.height / 2, 0);
    doorPanel.castShadow = true;
    doorPivot.add(doorPanel);

    // ── 门把手 ───────────────────────────────────────
    const handleGroup = new THREE.Group();

    // 把手杆
    const handleBar = new THREE.Mesh(
        new THREE.CylinderGeometry(HANDLE.radius, HANDLE.radius, HANDLE.length, 8),
        matMetal,
    );
    handleBar.rotation.x = Math.PI / 2; // 沿 z 轴伸出
    handleGroup.add(handleBar);

    // 把手底座（圆盘）
    const handleBase = new THREE.Mesh(
        new THREE.CylinderGeometry(HANDLE.radius * 2, HANDLE.radius * 2, 0.01, 12),
        matMetal,
    );
    handleBase.rotation.x = Math.PI / 2;
    handleGroup.add(handleBase);

    handleGroup.position.set(HANDLE.posX, HANDLE.posY, DOOR.thick / 2 + HANDLE.length / 2);
    doorPivot.add(handleGroup);

    group.add(doorPivot);

    // 保存引用，供动画使用
    group.userData.doorPivot = doorPivot;
    group.userData.isOpen = false;
    group.userData.targetRotation = 0;

    // 挂到前墙（北墙 z=+ROOM_DEPTH/2，门朝房间内部开）
    group.position.set(0, 0, ROOM_DEPTH / 2 - 0.01);

    return group;
}
