/**
 * 房间壳体：地板 + 天花板 + 四面墙（前墙留门洞，后墙留窗洞）
 *
 * 墙体策略：
 *   - 墙体内表面位置不变（±ROOM_HALF_W, ±ROOM_HALF_D），厚度向外延伸
 *   - 左右墙为主要墙（深度覆盖前后墙厚度），前后墙为次要墙（宽度在左右墙之间收缩）
 *   - 角落处自然重叠，无缝隙
 */
import * as THREE from 'three';
import { ROOM_WIDTH, ROOM_HEIGHT, ROOM_DEPTH, ROOM_HALF_W, ROOM_HALF_D, WALL_T, DOOR_WIDTH, DOOR_HEIGHT } from '../config.js';
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

    // ── 后墙 (z = -ROOM_DEPTH/2) — 四块拼出窗户洞口 ──
    const WIN_W = 5.0;                          // 窗宽
    const WIN_SILL = 0.25;                      // 窗台高度
    const WIN_TOP = WIN_SILL + (ROOM_HEIGHT - 0.5); // 窗顶 = 0.25 + 3.0 = 3.25
    const bwSideW = (ROOM_WIDTH - WIN_W - WALL_T) / 2;  // 两侧墙宽（缩 WALL_T 给左右墙让位）
    const bwTopH  = ROOM_HEIGHT - WIN_TOP;     // 窗上方墙高 = 0.25
    const bwBotH  = WIN_SILL;                  // 窗下方墙高 = 0.25

    // 后墙左侧 — BoxGeometry(宽, 高, 厚)
    const bwLeft = new THREE.Mesh(new THREE.BoxGeometry(bwSideW, ROOM_HEIGHT, WALL_T), matWall);
    bwLeft.position.set(-ROOM_HALF_W + WALL_T / 2 + bwSideW / 2, ROOM_HEIGHT / 2, -ROOM_HALF_D);
    bwLeft.receiveShadow = true;
    bwLeft.castShadow = true;
    room.add(bwLeft);

    // 后墙右侧
    const bwRight = new THREE.Mesh(new THREE.BoxGeometry(bwSideW, ROOM_HEIGHT, WALL_T), matWall);
    bwRight.position.set(ROOM_HALF_W - WALL_T / 2 - bwSideW / 2, ROOM_HEIGHT / 2, -ROOM_HALF_D);
    bwRight.receiveShadow = true;
    bwRight.castShadow = true;
    room.add(bwRight);

    // 后墙窗户上方
    const bwTop = new THREE.Mesh(new THREE.BoxGeometry(WIN_W, bwTopH, WALL_T), matWall);
    bwTop.position.set(0, WIN_TOP + bwTopH / 2, -ROOM_HALF_D);
    bwTop.receiveShadow = true;
    bwTop.castShadow = true;
    room.add(bwTop);

    // 后墙窗户下方
    const bwBot = new THREE.Mesh(new THREE.BoxGeometry(WIN_W, bwBotH, WALL_T), matWall);
    bwBot.position.set(0, bwBotH / 2, -ROOM_HALF_D);
    bwBot.receiveShadow = true;
    bwBot.castShadow = true;
    room.add(bwBot);

    // ── 左墙 (x = -ROOM_WIDTH/2) — 主要墙，深度覆盖前后墙 ──
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(WALL_T, ROOM_HEIGHT, ROOM_DEPTH + WALL_T), matWall);
    leftWall.position.set(-ROOM_HALF_W, ROOM_HEIGHT / 2, 0);
    leftWall.receiveShadow = true;
    leftWall.castShadow = true;
    room.add(leftWall);

    // ── 右墙 (x = +ROOM_WIDTH/2) — 主要墙，深度覆盖前后墙 ──
    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(WALL_T, ROOM_HEIGHT, ROOM_DEPTH + WALL_T), matWall);
    rightWall.position.set(ROOM_HALF_W, ROOM_HEIGHT / 2, 0);
    rightWall.receiveShadow = true;
    rightWall.castShadow = true;
    room.add(rightWall);

    // ── 前墙 (z = +ROOM_DEPTH/2) — 三块拼出居中门洞 ──
    const hx = DOOR_WIDTH / 2;               // 门洞半宽 = 0.6
    const sideW = (ROOM_WIDTH / 2 - hx - WALL_T / 2); // 门两侧墙宽（缩 WALL_T/2 给左右墙让位）
    const topH  = ROOM_HEIGHT - DOOR_HEIGHT;  // 门上方墙高 = 1.1

    // 左侧墙
    const fwLeft = new THREE.Mesh(new THREE.BoxGeometry(sideW, ROOM_HEIGHT, WALL_T), matWall);
    fwLeft.position.set(-ROOM_HALF_W + WALL_T / 2 + sideW / 2, ROOM_HEIGHT / 2, ROOM_HALF_D);
    fwLeft.receiveShadow = true;
    fwLeft.castShadow = true;
    room.add(fwLeft);

    // 右侧墙
    const fwRight = new THREE.Mesh(new THREE.BoxGeometry(sideW, ROOM_HEIGHT, WALL_T), matWall);
    fwRight.position.set(ROOM_HALF_W - WALL_T / 2 - sideW / 2, ROOM_HEIGHT / 2, ROOM_HALF_D);
    fwRight.receiveShadow = true;
    fwRight.castShadow = true;
    room.add(fwRight);

    // 门上方墙
    const fwTop = new THREE.Mesh(new THREE.BoxGeometry(DOOR_WIDTH, topH, WALL_T), matWall);
    fwTop.position.set(0, DOOR_HEIGHT + topH / 2, ROOM_HALF_D);
    fwTop.receiveShadow = true;
    fwTop.castShadow = true;
    room.add(fwTop);

    return room;
}
