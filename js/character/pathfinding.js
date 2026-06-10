/**
 * A* 网格寻路 —— 用于角色绕开家具走路
 *
 * 在房间地板上覆盖一个 2D 网格，标记被家具占据的格子为不可通行，
 * 用 A* 算法在网格上规划最短路径。
 *
 * 支持动态房间尺寸：调用 initGrid() 可切换到不同大小的房间。
 */
import * as THREE from 'three';

// ── 寻路参数 ──────────────────────────────────────────
const CELL_SIZE     = 0.1;   // 网格分辨率（米/格）
const CHAR_RADIUS   = 0.25;  // 角色碰撞半径（膨胀量）
const OBSTACLE_PAD  = 0.05;  // 家具额外边距
const WALL_MARGIN   = 0.35;  // 离墙最小距离（角色中心到墙的距离）
const DOOR_WIDTH    = 1.2;   // 门宽（米）

// ── 网格尺寸（动态，由 initGrid 设置）──────────────────
let GRID_W = 80;
let GRID_D = 70;
let GRID_ORIGIN_X = -4;
let GRID_ORIGIN_Z = -3.5;
let ROOM_HALF_W = 4;
let ROOM_HALF_D = 3.5;
let ROOM_CENTER_X = 0;
let ROOM_CENTER_Z = 0;

// ── 内部状态 ──────────────────────────────────────────
/** @type {Uint8Array} 0=可通行 1=障碍 */
let grid = new Uint8Array(GRID_W * GRID_D);

/** @type {THREE.Object3D|null} 门 group 引用（用于动态障碍） */
let doorRef = null;

// 预分配 A* 工作数组（避免每次 findPath 重新分配）
let gScoreBuf   = new Float32Array(GRID_W * GRID_D);
let cameFromBuf = new Int32Array(GRID_W * GRID_D);
let closedBuf   = new Uint8Array(GRID_W * GRID_D);

// ── 公开 API ──────────────────────────────────────────

/**
 * 初始化/切换寻路网格到新的房间尺寸
 * @param {number} halfW - 房间半宽（米）
 * @param {number} halfD - 房间半深（米）
 * @param {number} centerX - 房间中心 X（世界坐标）
 * @param {number} centerZ - 房间中心 Z（世界坐标）
 */
export function initGrid(halfW, halfD, centerX = 0, centerZ = 0) {
    ROOM_HALF_W = halfW;
    ROOM_HALF_D = halfD;
    ROOM_CENTER_X = centerX;
    ROOM_CENTER_Z = centerZ;

    GRID_W = Math.ceil(halfW * 2 / CELL_SIZE);
    GRID_D = Math.ceil(halfD * 2 / CELL_SIZE);
    GRID_ORIGIN_X = centerX - halfW;
    GRID_ORIGIN_Z = centerZ - halfD;

    // 重新分配网格和工作数组
    grid = new Uint8Array(GRID_W * GRID_D);
    gScoreBuf = new Float32Array(GRID_W * GRID_D);
    cameFromBuf = new Int32Array(GRID_W * GRID_D);
    closedBuf = new Uint8Array(GRID_W * GRID_D);
}

/**
 * 根据家具列表重建障碍网格
 * @param {THREE.Object3D[]} furnitureList - 主要家具 group 列表
 */
export function buildGrid(furnitureList) {
    _buildGridInternal(furnitureList);
}

/**
 * 设置门引用，开门时门板会作为动态障碍加入网格
 * @param {THREE.Object3D} door - 门 group
 */
export function setDoor(door) {
    doorRef = door;
}

function _buildGridInternal(furnitureList) {
    grid.fill(0);

    const inflate = CHAR_RADIUS + OBSTACLE_PAD;
    const box = new THREE.Box3();

    for (const obj of furnitureList) {
        if (!obj.visible) continue;

        // 计算 AABB（世界坐标，XZ 平面）
        box.setFromObject(obj);
        const minX = box.min.x - inflate;
        const maxX = box.max.x + inflate;
        const minZ = box.min.z - inflate;
        const maxZ = box.max.z + inflate;

        // 转换为网格坐标
        const gx0 = Math.max(0, Math.floor((minX - GRID_ORIGIN_X) / CELL_SIZE));
        const gx1 = Math.min(GRID_W - 1, Math.ceil((maxX - GRID_ORIGIN_X) / CELL_SIZE));
        const gz0 = Math.max(0, Math.floor((minZ - GRID_ORIGIN_Z) / CELL_SIZE));
        const gz1 = Math.min(GRID_D - 1, Math.ceil((maxZ - GRID_ORIGIN_Z) / CELL_SIZE));

        for (let gz = gz0; gz <= gz1; gz++) {
            for (let gx = gx0; gx <= gx1; gx++) {
                grid[gz * GRID_W + gx] = 1;
            }
        }
    }

    // 门打开时，门板甩入房间内部，作为动态障碍
    if (doorRef && doorRef.userData.isOpen) {
        box.setFromObject(doorRef);
        const dgx0 = Math.max(0, Math.floor((box.min.x - inflate - GRID_ORIGIN_X) / CELL_SIZE));
        const dgx1 = Math.min(GRID_W - 1, Math.ceil((box.max.x + inflate - GRID_ORIGIN_X) / CELL_SIZE));
        const dgz0 = Math.max(0, Math.floor((box.min.z - inflate - GRID_ORIGIN_Z) / CELL_SIZE));
        const dgz1 = Math.min(GRID_D - 1, Math.ceil((box.max.z + inflate - GRID_ORIGIN_Z) / CELL_SIZE));
        for (let gz = dgz0; gz <= dgz1; gz++) {
            for (let gx = dgx0; gx <= dgx1; gx++) {
                grid[gz * GRID_W + gx] = 1;
            }
        }
    }

    // 标记房间边界为障碍（防止角色贴墙或走出房间）
    // 四面墙全部标记，角色不得走出房间
    const wallCells = Math.floor(WALL_MARGIN / CELL_SIZE);
    // 后边界（Z 负方向 → 网格底部，gz=0 一侧）
    for (let gz = 0; gz < wallCells; gz++) {
        for (let gx = 0; gx < GRID_W; gx++) {
            grid[gz * GRID_W + gx] = 1;
        }
    }
    // 前边界（Z 正方向 → 网格顶部，gz=GRID_D-1 一侧）
    for (let gz = GRID_D - wallCells; gz < GRID_D; gz++) {
        for (let gx = 0; gx < GRID_W; gx++) {
            grid[gz * GRID_W + gx] = 1;
        }
    }

    // 前墙门洞：清除门宽范围内的障碍，让角色可以穿过门口
    // 门居中于前墙 (x=房间中心)，宽 DOOR_WIDTH
    const doorCenterX = ROOM_CENTER_X; // 门在房间中心 X
    const doorLeft  = worldToGridX(doorCenterX - DOOR_WIDTH / 2);
    const doorRight = worldToGridX(doorCenterX + DOOR_WIDTH / 2);
    for (let gz = GRID_D - wallCells; gz < GRID_D; gz++) {
        for (let gx = doorLeft; gx <= doorRight; gx++) {
            grid[gz * GRID_W + gx] = 0;
        }
    }
    // 左右边界（X 方向）
    for (let gz = 0; gz < GRID_D; gz++) {
        for (let gx = 0; gx < wallCells; gx++) {
            grid[gz * GRID_W + gx] = 1;
        }
        for (let gx = GRID_W - wallCells; gx < GRID_W; gx++) {
            grid[gz * GRID_W + gx] = 1;
        }
    }
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
    const openSet   = new MinHeap();
    gScoreBuf.fill(Infinity);
    cameFromBuf.fill(-1);
    closedBuf.fill(0);

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
            if (closedBuf[nIdx] || grid[nIdx]) continue; // grid=1 是障碍

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
 * 检查世界坐标是否可通行（供 walker.js 做位置校验）
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
 * 将世界坐标限制在房间可行走区域内（离墙至少 WALL_MARGIN）
 * @param {number} wx
 * @param {number} wz
 * @returns {{ x: number, z: number }}
 */
export function clampToRoomWorld(wx, wz) {
    const mx = ROOM_HALF_W - WALL_MARGIN;
    const mz = ROOM_HALF_D - WALL_MARGIN;
    return {
        x: Math.max(ROOM_CENTER_X - mx, Math.min(ROOM_CENTER_X + mx, wx)),
        z: Math.max(ROOM_CENTER_Z - mz, Math.min(ROOM_CENTER_Z + mz, wz)),
    };
}

/**
 * 检查从 (x0,z0) 到 (x1,z1) 的直线路径上所有网格格子是否都可通行
 * 用 Bresenham 遍历路径经过的每一格，防止角色对角移动穿过障碍物拐角
 * @param {number} x0
 * @param {number} z0
 * @param {number} x1
 * @param {number} z1
 * @returns {boolean}
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

// ── 内部函数 ──────────────────────────────────────────

/** 世界坐标 → 网格坐标 */
function worldToGridX(wx) {
    return THREE.MathUtils.clamp(Math.floor((wx - GRID_ORIGIN_X) / CELL_SIZE), 0, GRID_W - 1);
}
function worldToGridZ(wz) {
    return THREE.MathUtils.clamp(Math.floor((wz - GRID_ORIGIN_Z) / CELL_SIZE), 0, GRID_D - 1);
}

/** 网格坐标 → 世界坐标（格子中心） */
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

/**
 * 在附近搜索最近的可通行格（按实际距离排序，保证返回最近的）
 * 同时确保结果在房间有效区域内
 */
function findNearestFree(gx, gz, radius) {
    const wallCells = Math.floor(WALL_MARGIN / CELL_SIZE);
    let bestDist = Infinity;
    let best = null;

    for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
            if (dx === 0 && dz === 0) continue;
            const nx = gx + dx;
            const nz = gz + dz;
            if (!isWalkable(nx, nz)) continue;
            // 确保不在房间边界障碍带内（即确实在可行走区域）
            if (nx < wallCells || nx >= GRID_W - wallCells) continue;
            if (nz < wallCells || nz >= GRID_D - wallCells) continue;
            const dist = dx * dx + dz * dz; // 用距离平方比较，避免 sqrt
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
    return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz); // octile
}

function reconstructPath(cameFrom, endIdx) {
    const indices = [];
    let idx = endIdx;
    while (idx !== -1) {
        indices.push(idx);
        idx = cameFrom[idx];
    }
    indices.reverse();

    // 转换为世界坐标
    return indices.map(i => {
        const gx = i % GRID_W;
        const gz = (i - gx) / GRID_W;
        return gridToWorld(gx, gz);
    });
}

/**
 * Bresenham line-of-sight 检查，同时检查路径两侧相邻格子
 * 确保平滑路径不会贴着障碍物边缘走（角色有碰撞半径）
 */
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
        // 检查当前格子及两侧相邻格子（为角色半径留出空间）
        if (!isWalkable(x0, z0)) return false;
        // 垂直于行进方向偏移 1 格检查（根据主要行进方向选择偏移轴）
        if (dx >= dz) {
            // 主要沿 X 方向行进，检查 Z 方向两侧
            if (!isWalkable(x0, z0 + 1) || !isWalkable(x0, z0 - 1)) return false;
        } else {
            // 主要沿 Z 方向行进，检查 X 方向两侧
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
