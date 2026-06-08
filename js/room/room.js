/**
 * 房间壳体：地板 + 天花板 + 三面墙（前面敞开供摄像机观察）
 */
import * as THREE from 'three';
import { ROOM_WIDTH, ROOM_HEIGHT, ROOM_DEPTH } from '../config.js';
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

    return room;
}
