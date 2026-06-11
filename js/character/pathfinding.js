/**
 * A* 网格寻路 —— 统一网格覆盖整个公寓
 *
 * 用一个大网格覆盖所有房间，根据房间可见性动态标记障碍：
 * - 可见房间：标记家具为障碍，墙壁按配置标记，门口根据门开合状态处理
 * - 不可见房间：整个区域标记为障碍
 *
 * 支持跨房间寻路：角色可以从一个房间直接走到另一个房间（门口打开时）
 */
import * as THREE from 'three';

// ── 寻路参数 ──────────────────────────────────────────
const CELL_SIZE     = 0.1;   // 网格分辨率（米/格）
const CHAR_RADIUS   = 0.25;  // 角色碰撞半径（膨胀量）
const OBSTACLE_PAD  = 0.05;  // 家具额外边距
const WALL_MARGIN   = 0.35;  // 离墙最小距离（角色中心到墙的距离）
const DOOR_WIDTH    = 1.2;   // 门宽（米）

// ── 公寓级网格参数 ──────────────────────────────────
let GRID_W = 1;
let GRID_D = 1;
let GRID_ORIGIN_X = 0;
let GRID_ORIGIN_Z = 0;

// ── 内部状态 ──────────────────────────────────────────
/** @type {Uint8Array} 0=可通行 1=障碍 */
let grid = new Uint8Array(1);

// ── 公开 API ──────────────────────────────────────────

/**
 * 初始化公寓级寻路网格（在所有房间构建后调用一次）
 * @param {Map<string, object>} rooms - Apartment.rooms
 * @param {object|null} corridorBounds - 走廊边界 {minX, maxX, minZ, maxZ}
 * @param {object|null} grass - 草地参数 {centerX, centerZ, radius}
 */
export function initApartmentGrid(rooms, corridorBounds, grass) {
    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    for (const [, room] of rooms) {
        const p = room.position;
        const hw = room.bounds.halfW;
        const hd = room.bounds.halfD;
        minX = Math.min(minX, p.x - hw);
        maxX = Math.max(maxX, p.x + hw);
        minZ = Math.min(minZ, p.z - hd);
        maxZ = Math.max(maxZ, p.z + hd);
    }

    // 走廊边界也纳入网格范围
    if (corridorBounds) {
        minX = Math.min(minX, corridorBounds.minX);
        maxX = Math.max(maxX, corridorBounds.maxX);
        minZ = Math.min(minZ, corridorBounds.minZ);
        maxZ = Math.max(maxZ, corridorBounds.maxZ);
    }

    // 圆形草地范围
    if (grass) {
        minX = Math.min(minX, grass.centerX - grass.radius);
        maxX = Math.max(maxX, grass.centerX + grass.radius);
        minZ = Math.min(minZ, grass.centerZ - grass.radius);
        maxZ = Math.max(maxZ, grass.centerZ + grass.radius);
    }

    GRID_ORIGIN_X = minX;
    GRID_ORIGIN_Z = minZ;
    GRID_W = Math.max(1, Math.ceil((maxX - minX) / CELL_SIZE));
    GRID_D = Math.max(1, Math.ceil((maxZ - minZ) / CELL_SIZE));

    grid = new Uint8Array(GRID_W * GRID_D);
}

/**
 * 重建寻路网格（房间可见性或门状态变化时调用）
 * @param {Map<string, object>} rooms - Apartment.rooms
 * @param {object|null} corridorBounds - 走廊边界 {minX, maxX, minZ, maxZ}
 * @param {object|null} corridorExitDoor - 走廊尽头出口门（用于判断开合状态）
 * @param {object|null} shellDoor - 外壳门（用于判断开合状态）
 * @param {object|null} grass - 草地参数 {centerX, centerZ, radius}
 */
export function rebuildGrid(rooms, corridorBounds, corridorExitDoor, shellDoor, grass) {
    grid.fill(0);
    const inflate = CHAR_RADIUS + OBSTACLE_PAD;
    const box = new THREE.Box3();

    // 标记圆形草地范围外为障碍
    if (grass) {
        _markOutsideCircle(grass.centerX, grass.centerZ, grass.radius);
    }

    // 标记走廊墙壁（东西两端）
    if (corridorBounds) {
        _markCorridorWalls(corridorBounds, corridorExitDoor);
    }

    for (const [id, room] of rooms) {
        if (!room.result.group.visible) {
            // 不可见房间 → 整个区域标记为障碍
            _markRoomBounds(room, true);
            continue;
        }

        // 可见房间 → 标记墙壁边界
        _markRoomWalls(room);

        // 标记家具障碍
        for (const f of room.result.furniture) {
            if (!f.group.visible) continue;
            box.setFromObject(f.group);
            _markBox(box, inflate);
        }

        // 门打开时，门板甩入房间内，作为动态障碍（只标记门板，不标记墙壁面板）
        const door = room.result.door;
        if (door && door.userData.isOpen) {
            const doorPivot = door.userData.doorPivot;
            if (doorPivot) {
                box.setFromObject(doorPivot);
                _markBox(box, inflate);
            }
        }
    }

    // 走廊出口门打开时，门板也作为动态障碍
    if (corridorExitDoor && corridorExitDoor.userData.isOpen) {
        const exitPivot = corridorExitDoor.userData.doorPivot;
        if (exitPivot) {
            box.setFromObject(exitPivot);
            _markBox(box, inflate);
        }
    }

    // 外壳门：关闭时门口为障碍，打开时清除门口障碍
    if (shellDoor) {
        if (!shellDoor.userData.isOpen) {
            _markShellDoorWalls(shellDoor);
        } else {
            _clearShellDoorway();
        }
    }
}

/**
 * 检查世界坐标是否可通行
 * @param {number} wx
 * @param {number} wz
 * @returns {boolean}
 */
export function isWalkableWorld(wx, wz) {
    const gx = worldToGridX(wx);
    const gz = worldToGridZ(wz);
    if (gx < 0 || gx >= GRID_W || gz < 0 || gz >= GRID_D) return false;
    return grid[gz * GRID_W + gx] === 0;
}

/**
 * A* 寻路
 * @param {THREE.Vector3} start - 起点（世界坐标，取 x,z）
 * @param {THREE.Vector3} end   - 终点（世界坐标，取 x,z）
 * @returns {THREE.Vector3[]|null} 路径点数组（世界坐标），或 null（不可达）
 */
export function findPath(start, end) {
    const sx = worldToGridX(start.x);
    const sz = worldToGridZ(start.z);
    const ex = worldToGridX(end.x);
    const ez = worldToGridZ(end.z);

    // 起点在障碍内 → 尝试找最近可通行格
    let actualSx = sx, actualSz = sz;
    if (!isWalkable(sx, sz)) {
        const altStart = findNearestFree(sx, sz, 10);
        if (!altStart) return null;
        actualSx = altStart.x;
        actualSz = altStart.z;
    }

    // 终点在障碍内 → 尝试找最近可通行格
    let actualEx = ex, actualEz = ez;
    if (!isWalkable(ex, ez)) {
        const altEnd = findNearestFree(ex, ez, 10);
        if (!altEnd) return null;
        actualEx = altEnd.x;
        actualEz = altEnd.z;
    }

    // A*
    const totalCells = GRID_W * GRID_D;
    const gScoreBuf   = new Float32Array(totalCells);
    const cameFromBuf = new Int32Array(totalCells);
    const closedBuf   = new Uint8Array(totalCells);

    const openSet = new MinHeap();
    gScoreBuf.fill(Infinity);
    cameFromBuf.fill(-1);

    const startIdx = actualSz * GRID_W + actualSx;
    const endIdx   = actualEz * GRID_W + actualEx;

    gScoreBuf[startIdx] = 0;
    openSet.push(startIdx, heuristic(actualSx, actualSz, actualEx, actualEz));

    // 8 方向邻居偏移
    const DX = [-1, 0, 1, -1, 1, -1, 0, 1];
    const DZ = [-1, -1, -1, 0, 0, 1, 1, 1];
    const COST = [1.414, 1, 1.414, 1, 1, 1.414, 1, 1.414];

    while (openSet.size > 0) {
        const current = openSet.pop();
        if (current === endIdx) {
            return reconstructPath(cameFromBuf, endIdx);
        }

        if (closedBuf[current]) continue;
        closedBuf[current] = 1;

        const cx = current % GRID_W;
        const cz = (current - cx) / GRID_W;

        for (let d = 0; d < 8; d++) {
            const nx = cx + DX[d];
            const nz = cz + DZ[d];
            if (nx < 0 || nx >= GRID_W || nz < 0 || nz >= GRID_D) continue;

            const nIdx = nz * GRID_W + nx;
            if (closedBuf[nIdx] || grid[nIdx]) continue;

            // 斜角移动时检查两个正交邻居是否可通过（防止穿墙角）
            if (DX[d] !== 0 && DZ[d] !== 0) {
                if (grid[cz * GRID_W + nx] || grid[nz * GRID_W + cx]) continue;
            }

            const tentG = gScoreBuf[current] + COST[d];
            if (tentG < gScoreBuf[nIdx]) {
                gScoreBuf[nIdx] = tentG;
                cameFromBuf[nIdx] = current;
                openSet.push(nIdx, tentG + heuristic(nx, nz, actualEx, actualEz));
            }
        }
    }

    return null; // 不可达
}

/**
 * 路径平滑 —— 用 line-of-sight 检查删减多余路径点
 * @param {THREE.Vector3[]} path
 * @returns {THREE.Vector3[]}
 */
export function smoothPath(path) {
    if (path.length <= 2) return path;

    const result = [path[0]];
    let anchor = 0;

    while (anchor < path.length - 1) {
        let farthest = anchor + 1;
        for (let i = anchor + 2; i < path.length; i++) {
            if (hasLineOfSight(path[anchor], path[i])) {
                farthest = i;
            }
        }
        result.push(path[farthest]);
        anchor = farthest;
    }

    return result;
}

/**
 * 检查从 (x0,z0) 到 (x1,z1) 的直线路径是否可通行
 */
export function isPathClear(x0, z0, x1, z1) {
    let gx0 = worldToGridX(x0);
    let gz0 = worldToGridZ(z0);
    const gx1 = worldToGridX(x1);
    const gz1 = worldToGridZ(z1);

    const dx = Math.abs(gx1 - gx0);
    const dz = Math.abs(gz1 - gz0);
    const sx = gx0 < gx1 ? 1 : -1;
    const sz = gz0 < gz1 ? 1 : -1;
    let err = dx - dz;

    while (true) {
        if (!isWalkable(gx0, gz0)) return false;
        if (gx0 === gx1 && gz0 === gz1) break;
        const e2 = err * 2;
        if (e2 > -dz) { err -= dz; gx0 += sx; }
        if (e2 < dx)  { err += dx; gz0 += sz; }
    }
    return true;
}

// ── 内部函数：网格标记 ──────────────────────────────

/**
 * 标记房间墙壁边界为障碍，根据墙壁配置和门口状态
 *
 * 逻辑：
 * - 有墙的方向：标记 WALL_MARGIN 宽的障碍带（从墙面向内）
 * - 无墙的方向：不标记，允许通行（开放通道）
 * - 门口区域：始终清除障碍带（门框处不留 margin）
 *   - 门打开：门口可通行
 *   - 门关闭：门口由门板障碍单独阻挡
 */
function _markRoomWalls(room) {
    const p = room.position;
    const hw = room.bounds.halfW;
    const hd = room.bounds.halfD;

    // 收集有墙的方向
    const wallFacingSet = new Set();
    for (const w of room.config.walls) {
        wallFacingSet.add(w.facing);
    }

    // 收集各方向的门口位置（本地 X 坐标）
    const southDoors = [];
    const northDoors = [];
    for (const w of room.config.walls) {
        if (w.type === 'door') {
            if (w.facing === 'south') southDoors.push(0);
            if (w.facing === 'north') northDoors.push(0);
        }
    }
    for (const conn of room.connections) {
        const localZ = conn.doorPos.z - p.z;
        const localX = conn.doorPos.x - p.x;
        if (Math.abs(localZ + hd) < 0.5) southDoors.push(localX);
        if (Math.abs(localZ - hd) < 0.5) northDoors.push(localX);
    }

    const marginCells = Math.floor(WALL_MARGIN / CELL_SIZE);

    // ── 南边界（-z 方向）── 只在房间 x 范围内标记
    const door = room.result.door;
    const doorOpen = door && door.userData.isOpen;

    if (wallFacingSet.has('south')) {
        const gzEdge = worldToGridZ(p.z - hd);
        const gxMin = worldToGridX(p.x - hw);
        const gxMax = worldToGridX(p.x + hw);
        for (let i = 0; i < marginCells; i++) {
            const gz = gzEdge + i;
            if (gz < 0 || gz >= GRID_D) continue;
            for (let gx = gxMin; gx <= gxMax; gx++) {
                if (gx >= 0 && gx < GRID_W) {
                    grid[gz * GRID_W + gx] = 1;
                }
            }
        }
        // 门打开时清除门口障碍带（双向：房间内侧 + 外侧）
        if (doorOpen) {
            for (const doorCenterX of southDoors) {
                const gx0 = worldToGridX(p.x + doorCenterX - DOOR_WIDTH / 2);
                const gx1 = worldToGridX(p.x + doorCenterX + DOOR_WIDTH / 2);
                for (let i = -marginCells; i <= marginCells; i++) {
                    const gz = gzEdge + i;
                    if (gz < 0 || gz >= GRID_D) continue;
                    for (let gx = gx0; gx <= gx1; gx++) {
                        if (gx >= 0 && gx < GRID_W) grid[gz * GRID_W + gx] = 0;
                    }
                }
            }
        }
    }

    // ── 北边界（+z 方向）── 只在房间 x 范围内标记
    if (wallFacingSet.has('north')) {
        const gzEdge = worldToGridZ(p.z + hd);
        const gxMin = worldToGridX(p.x - hw);
        const gxMax = worldToGridX(p.x + hw);
        for (let i = 0; i < marginCells; i++) {
            const gz = gzEdge - i;
            if (gz < 0 || gz >= GRID_D) continue;
            for (let gx = gxMin; gx <= gxMax; gx++) {
                if (gx >= 0 && gx < GRID_W) {
                    grid[gz * GRID_W + gx] = 1;
                }
            }
        }
        // 门打开时清除门口障碍带
        if (doorOpen) {
            for (const doorCenterX of northDoors) {
                const gx0 = worldToGridX(p.x + doorCenterX - DOOR_WIDTH / 2);
                const gx1 = worldToGridX(p.x + doorCenterX + DOOR_WIDTH / 2);
                for (let i = -marginCells; i <= marginCells; i++) {
                    const gz = gzEdge - i;
                    if (gz < 0 || gz >= GRID_D) continue;
                    for (let gx = gx0; gx <= gx1; gx++) {
                        if (gx >= 0 && gx < GRID_W) grid[gz * GRID_W + gx] = 0;
                    }
                }
            }
        }
    }

    // ── 西边界（-x 方向）── 只在房间 z 范围内标记
    if (wallFacingSet.has('west')) {
        const gxEdge = worldToGridX(p.x - hw);
        const gzMin = worldToGridZ(p.z - hd);
        const gzMax = worldToGridZ(p.z + hd);
        for (let i = 0; i < marginCells; i++) {
            const gx = gxEdge + i;
            if (gx < 0 || gx >= GRID_W) continue;
            for (let gz = gzMin; gz <= gzMax; gz++) {
                if (gz >= 0 && gz < GRID_D) {
                    grid[gz * GRID_W + gx] = 1;
                }
            }
        }
    }

    // ── 东边界（+x 方向）── 只在房间 z 范围内标记
    if (wallFacingSet.has('east')) {
        const gxEdge = worldToGridX(p.x + hw);
        const gzMin = worldToGridZ(p.z - hd);
        const gzMax = worldToGridZ(p.z + hd);
        for (let i = 0; i < marginCells; i++) {
            const gx = gxEdge - i;
            if (gx < 0 || gx >= GRID_W) continue;
            for (let gz = gzMin; gz <= gzMax; gz++) {
                if (gz >= 0 && gz < GRID_D) {
                    grid[gz * GRID_W + gx] = 1;
                }
            }
        }
    }

}

/**
 * 标记走廊东西两端墙壁为障碍
 * @param {object} bounds - {minX, maxX, minZ, maxZ}
 * @param {object|null} corridorExitDoor - 走廊尽头出口门
 */
function _markCorridorWalls(bounds, corridorExitDoor) {
    const marginCells = Math.floor(WALL_MARGIN / CELL_SIZE);

    // 西墙 (x = minX)：有出口门，门口区域不标记
    const gxWest = worldToGridX(bounds.minX);
    const gzMin = worldToGridZ(bounds.minZ);
    const gzMax = worldToGridZ(bounds.maxZ);
    for (let i = 0; i < marginCells; i++) {
        const gx = gxWest + i;
        if (gx < 0 || gx >= GRID_W) continue;
        for (let gz = gzMin; gz <= gzMax; gz++) {
            if (gz >= 0 && gz < GRID_D) {
                grid[gz * GRID_W + gx] = 1;
            }
        }
    }
    // 出口门在走廊西墙中心 (z=5)，宽 1.2m，仅门打开时清除门口障碍
    const isExitDoorOpen = corridorExitDoor && corridorExitDoor.userData.isOpen;
    if (isExitDoorOpen) {
        const doorCenterZ = 5;
        const gzDoor0 = worldToGridZ(doorCenterZ - DOOR_WIDTH / 2);
        const gzDoor1 = worldToGridZ(doorCenterZ + DOOR_WIDTH / 2);
        for (let i = -marginCells; i <= marginCells; i++) {
            const gx = gxWest + i;
            if (gx < 0 || gx >= GRID_W) continue;
            for (let gz = gzDoor0; gz <= gzDoor1; gz++) {
                if (gz >= 0 && gz < GRID_D) {
                    grid[gz * GRID_W + gx] = 0;
                }
            }
        }
    }

    // 东墙 (x = maxX)：实心墙
    const gxEast = worldToGridX(bounds.maxX);
    for (let i = 0; i < marginCells; i++) {
        const gx = gxEast - i;
        if (gx < 0 || gx >= GRID_W) continue;
        for (let gz = gzMin; gz <= gzMax; gz++) {
            if (gz >= 0 && gz < GRID_D) {
                grid[gz * GRID_W + gx] = 1;
            }
        }
    }
}

/**
 * 标记房间边界为障碍（不可见房间整体封锁）
 */
function _markRoomBounds(room, fullBlock) {
    const p = room.position;
    const hw = room.bounds.halfW;
    const hd = room.bounds.halfD;

    const gx0 = worldToGridX(p.x - hw);
    const gx1 = worldToGridX(p.x + hw);
    const gz0 = worldToGridZ(p.z - hd);
    const gz1 = worldToGridZ(p.z + hd);

    if (fullBlock) {
        for (let gz = gz0; gz <= gz1; gz++) {
            for (let gx = gx0; gx <= gx1; gx++) {
                if (gx >= 0 && gx < GRID_W && gz >= 0 && gz < GRID_D) {
                    grid[gz * GRID_W + gx] = 1;
                }
            }
        }
    }
}

/**
 * 标记 AABB 为障碍（世界坐标）
 */
function _markBox(box, inflate) {
    const gx0 = worldToGridX(box.min.x - inflate);
    const gx1 = worldToGridX(box.max.x + inflate);
    const gz0 = worldToGridZ(box.min.z - inflate);
    const gz1 = worldToGridZ(box.max.z + inflate);
    for (let gz = gz0; gz <= gz1; gz++) {
        for (let gx = gx0; gx <= gx1; gx++) {
            if (gx >= 0 && gx < GRID_W && gz >= 0 && gz < GRID_D) {
                grid[gz * GRID_W + gx] = 1;
            }
        }
    }
}

// ── 坐标转换 ──────────────────────────────────────────

/**
 * 标记圆形草地范围外为障碍
 */
function _markOutsideCircle(cx, cz, radius) {
    const r2 = radius * radius;
    for (let gz = 0; gz < GRID_D; gz++) {
        for (let gx = 0; gx < GRID_W; gx++) {
            const wp = gridToWorld(gx, gz);
            const dx = wp.x - cx;
            const dz = wp.z - cz;
            if (dx * dx + dz * dz > r2) {
                grid[gz * GRID_W + gx] = 1;
            }
        }
    }
}

/**
 * 标记外壳门关闭时门口区域为障碍
 */
function _markShellDoorWalls(shellDoor) {
    // 外壳门在西墙，world_z = 5（EAVE_Z），宽 1.2m
    const doorCenterZ = 5;
    const wallX = -16.26;
    const marginCells = Math.floor(WALL_MARGIN / CELL_SIZE);
    const gz0 = worldToGridZ(doorCenterZ - DOOR_WIDTH / 2);
    const gz1 = worldToGridZ(doorCenterZ + DOOR_WIDTH / 2);
    for (let i = -marginCells; i <= marginCells; i++) {
        const gx = worldToGridX(wallX) + i;
        if (gx < 0 || gx >= GRID_W) continue;
        for (let gz = gz0; gz <= gz1; gz++) {
            if (gz >= 0 && gz < GRID_D) {
                grid[gz * GRID_W + gx] = 1;
            }
        }
    }
}

/**
 * 外壳门打开时，清除门口区域障碍（含走廊西墙门口）
 */
function _clearShellDoorway() {
    const doorCenterZ = 5;
    const marginCells = Math.floor(WALL_MARGIN / CELL_SIZE);
    const gz0 = worldToGridZ(doorCenterZ - DOOR_WIDTH / 2);
    const gz1 = worldToGridZ(doorCenterZ + DOOR_WIDTH / 2);
    // 从外壳门墙到走廊西墙之间的门口区域
    const gxShell = worldToGridX(-16.26);
    const gxCorridor = worldToGridX(-16);
    const gxMin = Math.min(gxShell, gxCorridor) - marginCells;
    const gxMax = Math.max(gxShell, gxCorridor) + marginCells;
    for (let gx = gxMin; gx <= gxMax; gx++) {
        if (gx < 0 || gx >= GRID_W) continue;
        for (let gz = gz0; gz <= gz1; gz++) {
            if (gz >= 0 && gz < GRID_D) {
                grid[gz * GRID_W + gx] = 0;
            }
        }
    }
}

function worldToGridX(wx) {
    return THREE.MathUtils.clamp(Math.floor((wx - GRID_ORIGIN_X) / CELL_SIZE), 0, GRID_W - 1);
}
function worldToGridZ(wz) {
    return THREE.MathUtils.clamp(Math.floor((wz - GRID_ORIGIN_Z) / CELL_SIZE), 0, GRID_D - 1);
}
function gridToWorld(gx, gz) {
    return new THREE.Vector3(
        GRID_ORIGIN_X + (gx + 0.5) * CELL_SIZE,
        0,
        GRID_ORIGIN_Z + (gz + 0.5) * CELL_SIZE,
    );
}

function isWalkable(gx, gz) {
    if (gx < 0 || gx >= GRID_W || gz < 0 || gz >= GRID_D) return false;
    return grid[gz * GRID_W + gx] === 0;
}

function findNearestFree(gx, gz, radius) {
    let bestDist = Infinity;
    let best = null;
    for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
            if (dx === 0 && dz === 0) continue;
            const nx = gx + dx;
            const nz = gz + dz;
            if (!isWalkable(nx, nz)) continue;
            const dist = dx * dx + dz * dz;
            if (dist < bestDist) {
                bestDist = dist;
                best = { x: nx, z: nz };
            }
        }
    }
    return best;
}

function heuristic(x0, z0, x1, z1) {
    const dx = Math.abs(x0 - x1);
    const dz = Math.abs(z0 - z1);
    return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
}

function reconstructPath(cameFrom, endIdx) {
    const indices = [];
    let idx = endIdx;
    while (idx !== -1) {
        indices.push(idx);
        idx = cameFrom[idx];
    }
    indices.reverse();
    return indices.map(i => {
        const gx = i % GRID_W;
        const gz = (i - gx) / GRID_W;
        return gridToWorld(gx, gz);
    });
}

function hasLineOfSight(a, b) {
    let x0 = worldToGridX(a.x);
    let z0 = worldToGridZ(a.z);
    const x1 = worldToGridX(b.x);
    const z1 = worldToGridZ(b.z);

    const dx = Math.abs(x1 - x0);
    const dz = Math.abs(z1 - z0);
    const sx = x0 < x1 ? 1 : -1;
    const sz = z0 < z1 ? 1 : -1;
    let err = dx - dz;

    while (true) {
        if (!isWalkable(x0, z0)) return false;
        if (dx >= dz) {
            if (!isWalkable(x0, z0 + 1) || !isWalkable(x0, z0 - 1)) return false;
        } else {
            if (!isWalkable(x0 + 1, z0) || !isWalkable(x0 - 1, z0)) return false;
        }
        if (x0 === x1 && z0 === z1) break;
        const e2 = err * 2;
        if (e2 > -dz) { err -= dz; x0 += sx; }
        if (e2 < dx)  { err += dx; z0 += sz; }
    }
    return true;
}

// ── 最小堆 ────────────────────────────────────────────

class MinHeap {
    constructor() {
        this.data = [];
    }
    get size() { return this.data.length; }
    push(idx, priority) {
        this.data.push({ idx, priority });
        this._bubbleUp(this.data.length - 1);
    }
    pop() {
        const top = this.data[0];
        const last = this.data.pop();
        if (this.data.length > 0) {
            this.data[0] = last;
            this._sinkDown(0);
        }
        return top.idx;
    }
    _bubbleUp(i) {
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (this.data[p].priority <= this.data[i].priority) break;
            [this.data[p], this.data[i]] = [this.data[i], this.data[p]];
            i = p;
        }
    }
    _sinkDown(i) {
        const n = this.data.length;
        while (true) {
            let smallest = i;
            const l = 2 * i + 1;
            const r = 2 * i + 2;
            if (l < n && this.data[l].priority < this.data[smallest].priority) smallest = l;
            if (r < n && this.data[r].priority < this.data[smallest].priority) smallest = r;
            if (smallest === i) break;
            [this.data[smallest], this.data[i]] = [this.data[i], this.data[smallest]];
            i = smallest;
        }
    }
}
