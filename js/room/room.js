/**
 * 房间壳体：地板 + 天花板 + 四面墙（前墙留门洞，后墙留窗洞）
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

    // 后墙 (z = -ROOM_DEPTH/2) — 四块拼出窗户洞口
    const WIN_W = 5.0;                          // 窗宽
    const WIN_SILL = 0.25;                      // 窗台高度
    const WIN_TOP = WIN_SILL + (ROOM_HEIGHT - 0.5); // 窗顶 = 0.25 + 3.0 = 3.25
    const bwSideW = (ROOM_WIDTH - WIN_W) / 2;  // 两侧墙宽 = 1.5
    const bwTopH  = ROOM_HEIGHT - WIN_TOP;     // 窗上方墙高 = 0.25
    const bwBotH  = WIN_SILL;                  // 窗下方墙高 = 0.25

    // 后墙左侧
    const bwLeft = new THREE.Mesh(new THREE.PlaneGeometry(bwSideW, ROOM_HEIGHT), matWall);
    bwLeft.position.set(-ROOM_WIDTH / 2 + bwSideW / 2, ROOM_HEIGHT / 2, -ROOM_DEPTH / 2);
    bwLeft.receiveShadow = true;
    room.add(bwLeft);

    // 后墙右侧
    const bwRight = new THREE.Mesh(new THREE.PlaneGeometry(bwSideW, ROOM_HEIGHT), matWall);
    bwRight.position.set(ROOM_WIDTH / 2 - bwSideW / 2, ROOM_HEIGHT / 2, -ROOM_DEPTH / 2);
    bwRight.receiveShadow = true;
    room.add(bwRight);

    // 后墙窗户上方
    const bwTop = new THREE.Mesh(new THREE.PlaneGeometry(WIN_W, bwTopH), matWall);
    bwTop.position.set(0, WIN_TOP + bwTopH / 2, -ROOM_DEPTH / 2);
    bwTop.receiveShadow = true;
    room.add(bwTop);

    // 后墙窗户下方
    const bwBot = new THREE.Mesh(new THREE.PlaneGeometry(WIN_W, bwBotH), matWall);
    bwBot.position.set(0, bwBotH / 2, -ROOM_DEPTH / 2);
    bwBot.receiveShadow = true;
    room.add(bwBot);

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
