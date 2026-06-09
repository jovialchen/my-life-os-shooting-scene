/**
 * 房间壳体：地板 + 天花板 + 四面墙（前墙留门洞）
 */
import * as THREE from 'three';
import { ROOM_WIDTH, ROOM_HEIGHT, ROOM_DEPTH, DOOR_WIDTH, DOOR_HEIGHT } from '../config.js';
import { matWall, matFloor, matCeiling } from '../materials.js';

export function createRoom() {
    const room = new THREE.Group();

    // 地板
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_DEPTH), matFloor);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    room.add(floor);

    // 天花板
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_DEPTH), matCeiling);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = ROOM_HEIGHT;
    room.add(ceil);

    // 后墙 (z = -ROOM_DEPTH/2)
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_HEIGHT), matWall);
    backWall.position.set(0, ROOM_HEIGHT / 2, -ROOM_DEPTH / 2);
    backWall.receiveShadow = true;
    room.add(backWall);

    // 左墙 (x = -ROOM_WIDTH/2)
    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_DEPTH, ROOM_HEIGHT), matWall);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-ROOM_WIDTH / 2, ROOM_HEIGHT / 2, 0);
    leftWall.receiveShadow = true;
    room.add(leftWall);

    // 右墙 (x = +ROOM_WIDTH/2)
    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_DEPTH, ROOM_HEIGHT), matWall);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(ROOM_WIDTH / 2, ROOM_HEIGHT / 2, 0);
    rightWall.receiveShadow = true;
    room.add(rightWall);

    // 前墙 (z = +ROOM_DEPTH/2) — 三块拼出居中门洞
    const hx = DOOR_WIDTH / 2;               // 门洞半宽 = 0.6
    const sideW = (ROOM_WIDTH / 2 - hx);     // 门两侧墙宽 = 3.4
    const topH  = ROOM_HEIGHT - DOOR_HEIGHT;  // 门上方墙高 = 1.1

    // 左侧墙
    const fwLeft = new THREE.Mesh(new THREE.PlaneGeometry(sideW, ROOM_HEIGHT), matWall);
    fwLeft.rotation.y = Math.PI;
    fwLeft.position.set(-ROOM_WIDTH / 2 + sideW / 2, ROOM_HEIGHT / 2, ROOM_DEPTH / 2);
    fwLeft.receiveShadow = true;
    room.add(fwLeft);

    // 右侧墙
    const fwRight = new THREE.Mesh(new THREE.PlaneGeometry(sideW, ROOM_HEIGHT), matWall);
    fwRight.rotation.y = Math.PI;
    fwRight.position.set(ROOM_WIDTH / 2 - sideW / 2, ROOM_HEIGHT / 2, ROOM_DEPTH / 2);
    fwRight.receiveShadow = true;
    room.add(fwRight);

    // 门上方墙
    const fwTop = new THREE.Mesh(new THREE.PlaneGeometry(DOOR_WIDTH, topH), matWall);
    fwTop.rotation.y = Math.PI;
    fwTop.position.set(0, DOOR_HEIGHT + topH / 2, ROOM_DEPTH / 2);
    fwTop.receiveShadow = true;
    room.add(fwTop);

    return room;
}
