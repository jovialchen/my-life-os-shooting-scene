/**
 * A* 网格寻路 —— 模型驱动的带高度多层导航网格
 *
 * 设计见 doc/design-surface-system.md §3「导航网格生成器」：
 *   - 数据源不再是硬编码的房间/墙壁参数，而是 surfaceParser 从 GLB
 *     提取的 walkable / obstacle mesh（岛屿 WALK_ 顶面、房屋 WALK_ 地板/楼梯等）
 *   - 每个格子保存若干「高度层」（多层楼面/楼梯共存于同一 XZ 投影）
 *   - A* 状态 = (格子, 高度层)，相邻层高差 ≤ MAX_STEP 才可通行（楼梯靠渐变）
 *   - 障碍物按净空规则剔除高度层：障碍点 y ∈ (层高+STEP_TOL, 层高+CHAR_HEIGHT)
 *   - 门是动态障碍：rebuildDynamicObstacles() 在静态网格副本上叠加关门的门板
 */
import * as THREE from 'three';

// ── 寻路参数 ──────────────────────────────────────────
const CELL_SIZE   = 0.1;    // 网格分辨率（米/格）
const MAX_LEVELS  = 4;      // 每格最多高度层数
const LEVEL_MERGE = 0.4;    // 高度差小于此值合并为一层
const MAX_STEP    = 0.35;   // 单步可跨越高差（楼梯踏步/斜坡）
const STEP_TOL    = 0.15;   // 障碍物高出地面此值才算挡路
const CHAR_HEIGHT = 1.6;    // 角色所需净空高度
const CHAR_RADIUS = 0.25;   // 角色碰撞半径（障碍膨胀量）
const SAMPLE_STEP = CELL_SIZE * 0.5;  // 三角形光栅化采样间距
const GRID_PAD    = 0.5;    // 网格范围外扩

// ── 网格状态 ──────────────────────────────────────────
let GRID_W = 0;
let GRID_D = 0;
let ORIGIN_X = 0;
let ORIGIN_Z = 0;

// 每格 MAX_LEVELS 个高度槽；counts=有效层数，heights=层高（升序）
let staticCounts = new Uint8Array(0);
let staticHeights = new Float32Array(0);
let counts = new Uint8Array(0);
let heights = new Float32Array(0);

// A* 缓冲区（buildNavGrid 时按网格大小分配，避免每次寻路分配）
let gScoreBuf = new Float32Array(0);
let cameFromBuf = new Int32Array(0);
let closedBuf = new Uint8Array(0);

let walkMeshes = [];   // 点击射线检测用

// ── 公开 API ──────────────────────────────────────────

/**
 * 从表面数据构建静态导航网格（模型加载完成后调用一次）
 * @param {{ walkable: THREE.Mesh[], obstacles: THREE.Mesh[] }} surfaces
 */
export function buildNavGrid({ walkable, obstacles }) {
    const t0 = performance.now();
    walkMeshes = walkable;

    // 1. 网格范围 = walkable 包围盒并集 + 外扩
    const box = new THREE.Box3();
    const bounds = new THREE.Box3();
    for (const mesh of walkable) {
        box.setFromObject(mesh);
        bounds.union(box);
    }
    if (bounds.isEmpty()) {
        console.warn('[Nav] 没有 walkable 表面，导航网格为空');
        return;
    }
    ORIGIN_X = bounds.min.x - GRID_PAD;
    ORIGIN_Z = bounds.min.z - GRID_PAD;
    GRID_W = Math.ceil((bounds.max.x - bounds.min.x + GRID_PAD * 2) / CELL_SIZE);
    GRID_D = Math.ceil((bounds.max.z - bounds.min.z + GRID_PAD * 2) / CELL_SIZE);

    const totalCells = GRID_W * GRID_D;
    staticCounts = new Uint8Array(totalCells);
    staticHeights = new Float32Array(totalCells * MAX_LEVELS);
    counts = new Uint8Array(totalCells);
    heights = new Float32Array(totalCells * MAX_LEVELS);
    gScoreBuf = new Float32Array(totalCells * MAX_LEVELS);
    cameFromBuf = new Int32Array(totalCells * MAX_LEVELS);
    closedBuf = new Uint8Array(totalCells * MAX_LEVELS);

    // 2. 光栅化 walkable 面 → 写入高度层
    for (const mesh of walkable) {
        rasterizeMesh(mesh, (cell, y) => addLevel(staticCounts, staticHeights, cell, y));
    }

    // 3. 光栅化障碍物 → 按净空规则剔除高度层（含角色半径膨胀）
    //    userData.nav_no_inflate 的障碍（如楼梯踏步）不膨胀：
    //    楼梯坡度陡，膨胀会把上一级踏步的净空判定扩散到坡面格上
    for (const mesh of obstacles) {
        const inflate = !mesh.userData?.nav_no_inflate;
        rasterizeMesh(mesh, (cell, y) => blockAt(staticCounts, staticHeights, cell, y, inflate));
    }

    // 4. 复制到动态网格
    counts.set(staticCounts);
    heights.set(staticHeights);

    console.log(`[Nav] 网格 ${GRID_W}x${GRID_D}，${walkable.length} 个可行走面，`
        + `${obstacles.length} 个障碍，耗时 ${Math.round(performance.now() - t0)}ms`);
}

/**
 * 重建动态障碍（门开合时调用）：静态网格副本 + 关门门板盒
 * @param {THREE.Box3[]} closedDoorBoxes - 处于关闭状态的门板世界包围盒
 */
export function rebuildDynamicObstacles(closedDoorBoxes) {
    if (counts.length === 0) return;
    counts.set(staticCounts);
    heights.set(staticHeights);
    for (const box of closedDoorBoxes) {
        markBoxBlocked(box);
    }
}

/** 点击走动时射线检测的可行走 mesh 列表 */
export function getWalkableMeshes() {
    return walkMeshes;
}

/** 调试：取某格的所有高度层 */
export function debugLevelsAt(wx, wz) {
    const gx = worldToGridX(wx);
    const gz = worldToGridZ(wz);
    if (gx < 0 || gx >= GRID_W || gz < 0 || gz >= GRID_D) return [];
    const cell = gz * GRID_W + gx;
    return Array.from(heights.slice(cell * MAX_LEVELS, cell * MAX_LEVELS + counts[cell]));
}

/**
 * 检查世界坐标是否可通行
 * @param {number} wy - 可选；给出时要求存在高差 ≤ MAX_STEP 的层
 */
export function isWalkableWorld(wx, wz, wy = Infinity) {
    const gx = worldToGridX(wx);
    const gz = worldToGridZ(wz);
    if (gx < 0 || gx >= GRID_W || gz < 0 || gz >= GRID_D) return false;
    const cell = gz * GRID_W + gx;
    const n = counts[cell];
    if (n === 0) return false;
    if (!Number.isFinite(wy)) return true;
    return nearestLevel(cell, wy, MAX_STEP) >= 0;
}

/**
 * 取 (wx,wz) 处最接近 wy 的地面高度（跟随地面/爬楼梯用）
 * @returns {number|null} 无合适层（高差 > 1m）时返回 null
 */
export function groundHeightAt(wx, wz, wy) {
    const gx = worldToGridX(wx);
    const gz = worldToGridZ(wz);
    if (gx < 0 || gx >= GRID_W || gz < 0 || gz >= GRID_D) return null;
    const cell = gz * GRID_W + gx;
    const lvl = nearestLevel(cell, wy, 1.0);
    return lvl >= 0 ? heights[cell * MAX_LEVELS + lvl] : null;
}

/**
 * A* 寻路（多层高度网格）
 * @param {THREE.Vector3} start - 起点（含 y）
 * @param {THREE.Vector3} end   - 终点（含 y）
 * @returns {THREE.Vector3[]|null} 路径点数组（含 y），或 null（不可达）
 */
export function findPath(start, end) {
    if (counts.length === 0) return null;

    const s = locateLevel(start.x, start.y, start.z);
    const e = locateLevel(end.x, end.y, end.z);
    if (!s || !e) return null;

    const totalStates = GRID_W * GRID_D * MAX_LEVELS;
    gScoreBuf.fill(Infinity);
    cameFromBuf.fill(-1);
    closedBuf.fill(0);

    const openSet = new MinHeap();
    const startState = s.cell * MAX_LEVELS + s.level;
    const endCell = e.cell;
    const endLvl = e.level;

    gScoreBuf[startState] = 0;
    openSet.push(startState, heuristic(s.cell % GRID_W, (s.cell / GRID_W) | 0,
        endCell % GRID_W, (endCell / GRID_W) | 0));

    const DX = [-1, 0, 1, -1, 1, -1, 0, 1];
    const DZ = [-1, -1, -1, 0, 0, 1, 1, 1];
    const COST = [1.414, 1, 1.414, 1, 1, 1.414, 1, 1.414];

    while (openSet.size > 0) {
        const current = openSet.pop();
        if (closedBuf[current]) continue;
        closedBuf[current] = 1;

        const curCell = (current / MAX_LEVELS) | 0;
        const curLvl = current % MAX_LEVELS;

        if (curCell === endCell && curLvl === endLvl) {
            return reconstructPath(cameFromBuf, current);
        }

        const cx = curCell % GRID_W;
        const cz = (curCell / GRID_W) | 0;
        const curH = heights[curCell * MAX_LEVELS + curLvl];

        for (let d = 0; d < 8; d++) {
            const nx = cx + DX[d];
            const nz = cz + DZ[d];
            if (nx < 0 || nx >= GRID_W || nz < 0 || nz >= GRID_D) continue;
            const nCell = nz * GRID_W + nx;

            // 邻居格中与当前层高差 ≤ MAX_STEP 的最佳层
            const nLvl = nearestLevel(nCell, curH, MAX_STEP);
            if (nLvl < 0) continue;

            // 斜角移动时两个正交邻居也要可达（防止穿墙角）
            if (DX[d] !== 0 && DZ[d] !== 0) {
                if (nearestLevel(cz * GRID_W + nx, curH, MAX_STEP) < 0) continue;
                if (nearestLevel(nz * GRID_W + cx, curH, MAX_STEP) < 0) continue;
            }

            const nState = nCell * MAX_LEVELS + nLvl;
            if (closedBuf[nState]) continue;

            const dh = Math.abs(heights[nCell * MAX_LEVELS + nLvl] - curH);
            // 爬高惩罚：爬楼梯比平地慢
            const tentG = gScoreBuf[current] + COST[d] * (1 + (dh / MAX_STEP) * 0.5);
            if (tentG < gScoreBuf[nState]) {
                gScoreBuf[nState] = tentG;
                cameFromBuf[nState] = current;
                openSet.push(nState, tentG + heuristic(nx, nz,
                    endCell % GRID_W, (endCell / GRID_W) | 0));
            }
        }
    }

    return null; // 不可达
}

/**
 * 路径平滑 —— 用带高度的 line-of-sight 检查删减多余路径点
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
 * 检查从 (x0,z0) 到 (x1,z1) 的直线路径是否可通行（高度沿 y0→y1 插值）
 */
export function isPathClear(x0, z0, x1, z1, y0 = Infinity, y1 = Infinity) {
    if (!Number.isFinite(y0) || !Number.isFinite(y1)) {
        // 无高度信息时退化为「每层都可」的 2D 检查
        return hasLineOfSight(
            new THREE.Vector3(x0, NaN, z0),
            new THREE.Vector3(x1, NaN, z1),
        );
    }
    return hasLineOfSight(
        new THREE.Vector3(x0, y0, z0),
        new THREE.Vector3(x1, y1, z1),
    );
}

// ── 内部：光栅化 ──────────────────────────────────────

const _v0 = new THREE.Vector3();
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _p = new THREE.Vector3();

/**
 * 把 mesh 的三角形按 3D 重心坐标采样，投影到 XZ 网格，回调 (cellIndex, y)
 * （3D 采样对水平地板、斜坡楼梯、竖直墙面都适用）
 */
function rasterizeMesh(mesh, onSample) {
    const geom = mesh.geometry;
    const pos = geom.attributes.position;
    if (!pos) return;
    const index = geom.index;
    const triCount = index ? index.count / 3 : pos.count / 3;
    mesh.updateWorldMatrix(true, false);
    const m = mesh.matrixWorld;

    for (let t = 0; t < triCount; t++) {
        const i0 = index ? index.getX(t * 3) : t * 3;
        const i1 = index ? index.getX(t * 3 + 1) : t * 3 + 1;
        const i2 = index ? index.getX(t * 3 + 2) : t * 3 + 2;
        _v0.fromBufferAttribute(pos, i0).applyMatrix4(m);
        _v1.fromBufferAttribute(pos, i1).applyMatrix4(m);
        _v2.fromBufferAttribute(pos, i2).applyMatrix4(m);

        const e1x = _v1.x - _v0.x, e1y = _v1.y - _v0.y, e1z = _v1.z - _v0.z;
        const e2x = _v2.x - _v0.x, e2y = _v2.y - _v0.y, e2z = _v2.z - _v0.z;
        const len1 = Math.hypot(e1x, e1y, e1z);
        const len2 = Math.hypot(e2x, e2y, e2z);
        const n1 = Math.max(1, Math.ceil(len1 / SAMPLE_STEP));
        const n2 = Math.max(1, Math.ceil(len2 / SAMPLE_STEP));

        for (let i = 0; i <= n1; i++) {
            const u = i / n1;
            for (let j = 0; j <= n2; j++) {
                const v = j / n2;
                if (u + v > 1) break;
                _p.set(
                    _v0.x + u * e1x + v * e2x,
                    _v0.y + u * e1y + v * e2y,
                    _v0.z + u * e1z + v * e2z,
                );
                const gx = worldToGridX(_p.x);
                const gz = worldToGridZ(_p.z);
                if (gx < 0 || gx >= GRID_W || gz < 0 || gz >= GRID_D) continue;
                onSample(gz * GRID_W + gx, _p.y);
            }
        }
    }
}

/** 向格子写入一个高度层（升序，相近高度合并取高者） */
function addLevel(cnt, hgt, cell, y) {
    const base = cell * MAX_LEVELS;
    const n = cnt[cell];
    for (let i = 0; i < n; i++) {
        if (Math.abs(hgt[base + i] - y) < LEVEL_MERGE) {
            if (y > hgt[base + i]) hgt[base + i] = y;
            return;
        }
    }
    if (n >= MAX_LEVELS) return;
    // 升序插入
    let i = n;
    while (i > 0 && hgt[base + i - 1] > y) {
        hgt[base + i] = hgt[base + i - 1];
        i--;
    }
    hgt[base + i] = y;
    cnt[cell] = n + 1;
}

/** 障碍点 (cell, y)：剔除净空冲突的高度层，并按角色半径膨胀到邻居格 */
function blockAt(cnt, hgt, cell, y, inflate = true) {
    // 先查本格有没有会被挡的层，没有就跳过膨胀（绝大多数采样走这里）
    if (!hasBlockedLevel(cnt, hgt, cell, y)) return;
    removeBlockedLevels(cnt, hgt, cell, y);
    if (!inflate) return;

    const gx = cell % GRID_W;
    const gz = (cell / GRID_W) | 0;
    const r = Math.ceil(CHAR_RADIUS / CELL_SIZE);
    for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
            if (dx === 0 && dz === 0) continue;
            if (dx * dx + dz * dz > r * r) continue;
            const nx = gx + dx, nz = gz + dz;
            if (nx < 0 || nx >= GRID_W || nz < 0 || nz >= GRID_D) continue;
            removeBlockedLevels(cnt, hgt, nz * GRID_W + nx, y);
        }
    }
}

function hasBlockedLevel(cnt, hgt, cell, y) {
    const base = cell * MAX_LEVELS;
    const n = cnt[cell];
    for (let i = 0; i < n; i++) {
        const h = hgt[base + i];
        if (y > h + STEP_TOL && y < h + CHAR_HEIGHT) return true;
    }
    return false;
}

function removeBlockedLevels(cnt, hgt, cell, y) {
    const base = cell * MAX_LEVELS;
    let n = cnt[cell];
    for (let i = 0; i < n; i++) {
        const h = hgt[base + i];
        if (y > h + STEP_TOL && y < h + CHAR_HEIGHT) {
            // 删除该层（后续层前移）
            for (let j = i; j < n - 1; j++) hgt[base + j] = hgt[base + j + 1];
            n--;
            i--;
        }
    }
    cnt[cell] = n;
}

/** 关门门板包围盒 → 动态障碍（膨胀 CHAR_RADIUS） */
function markBoxBlocked(box) {
    const gx0 = Math.max(0, worldToGridX(box.min.x - CHAR_RADIUS));
    const gx1 = Math.min(GRID_W - 1, worldToGridX(box.max.x + CHAR_RADIUS));
    const gz0 = Math.max(0, worldToGridZ(box.min.z - CHAR_RADIUS));
    const gz1 = Math.min(GRID_D - 1, worldToGridZ(box.max.z + CHAR_RADIUS));
    for (let gz = gz0; gz <= gz1; gz++) {
        for (let gx = gx0; gx <= gx1; gx++) {
            const cell = gz * GRID_W + gx;
            const base = cell * MAX_LEVELS;
            let n = counts[cell];
            for (let i = 0; i < n; i++) {
                const h = heights[base + i];
                // 门板垂直范围与该层站立空间相交 → 剔除
                if (box.min.y < h + CHAR_HEIGHT && box.max.y > h + STEP_TOL) {
                    for (let j = i; j < n - 1; j++) heights[base + j] = heights[base + j + 1];
                    n--;
                    i--;
                }
            }
            counts[cell] = n;
        }
    }
}

// ── 内部：层定位 / 坐标转换 ───────────────────────────

/** 格子内最接近 y 且高差 ≤ maxDiff 的层号，无则 -1 */
function nearestLevel(cell, y, maxDiff) {
    const base = cell * MAX_LEVELS;
    const n = counts[cell];
    let best = -1;
    let bestDiff = maxDiff;
    for (let i = 0; i < n; i++) {
        const d = Math.abs(heights[base + i] - y);
        if (d <= bestDiff) {
            bestDiff = d;
            best = i;
        }
    }
    return best;
}

/** 世界坐标 → (格子, 层)；被挡时在附近找自由格 */
function locateLevel(wx, wy, wz) {
    let gx = worldToGridX(wx);
    let gz = worldToGridZ(wz);
    const inGrid = (x, z) => x >= 0 && x < GRID_W && z >= 0 && z < GRID_D;

    if (inGrid(gx, gz)) {
        const cell = gz * GRID_W + gx;
        const lvl = nearestLevel(cell, wy, 1.0);
        if (lvl >= 0) return { cell, level: lvl };
    }
    // 螺旋找最近自由格（半径 10 格 = 1m）
    for (let r = 1; r <= 10; r++) {
        for (let dz = -r; dz <= r; dz++) {
            for (let dx = -r; dx <= r; dx++) {
                if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
                const nx = gx + dx, nz = gz + dz;
                if (!inGrid(nx, nz)) continue;
                const cell = nz * GRID_W + nx;
                const lvl = nearestLevel(cell, wy, 1.0);
                if (lvl >= 0) return { cell, level: lvl };
            }
        }
    }
    return null;
}

function worldToGridX(wx) { return Math.floor((wx - ORIGIN_X) / CELL_SIZE); }
function worldToGridZ(wz) { return Math.floor((wz - ORIGIN_Z) / CELL_SIZE); }
function gridToWorld(gx, gz) {
    return {
        x: (gx + 0.5) * CELL_SIZE + ORIGIN_X,
        z: (gz + 0.5) * CELL_SIZE + ORIGIN_Z,
    };
}

// ── 内部：A* 工具 ─────────────────────────────────────

function heuristic(x0, z0, x1, z1) {
    const dx = Math.abs(x1 - x0);
    const dz = Math.abs(z1 - z0);
    return Math.max(dx, dz) + 0.414 * Math.min(dx, dz);
}

function reconstructPath(cameFrom, endState) {
    const path = [];
    let cur = endState;
    while (cur !== -1) {
        const cell = (cur / MAX_LEVELS) | 0;
        const lvl = cur % MAX_LEVELS;
        const wp = gridToWorld(cell % GRID_W, (cell / GRID_W) | 0);
        path.push(new THREE.Vector3(wp.x, heights[cell * MAX_LEVELS + lvl], wp.z));
        cur = cameFrom[cur];
    }
    path.reverse();
    return path;
}

/**
 * 带高度的视线检查：沿线采样，每点要求存在与插值 y 高差 ≤ MAX_STEP 的层
 * y 为 NaN 时退化为只要求格子有任何层
 */
function hasLineOfSight(a, b) {
    const dist = Math.hypot(b.x - a.x, b.z - a.z);
    const steps = Math.max(1, Math.ceil(dist / (CELL_SIZE * 0.8)));
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const wx = a.x + (b.x - a.x) * t;
        const wz = a.z + (b.z - a.z) * t;
        const gx = worldToGridX(wx);
        const gz = worldToGridZ(wz);
        if (gx < 0 || gx >= GRID_W || gz < 0 || gz >= GRID_D) return false;
        const cell = gz * GRID_W + gx;
        if (counts[cell] === 0) return false;
        if (Number.isNaN(a.y) || Number.isNaN(b.y)) continue;
        const y = a.y + (b.y - a.y) * t;
        if (nearestLevel(cell, y, MAX_STEP) < 0) return false;
    }
    return true;
}

// ── 最小堆 ────────────────────────────────────────────

class MinHeap {
    constructor() {
        this.keys = [];
        this.prios = [];
    }
    get size() { return this.keys.length; }
    push(key, prio) {
        this.keys.push(key);
        this.prios.push(prio);
        let i = this.keys.length - 1;
        while (i > 0) {
            const parent = (i - 1) >> 1;
            if (this.prios[parent] <= this.prios[i]) break;
            this._swap(i, parent);
            i = parent;
        }
    }
    pop() {
        const top = this.keys[0];
        const lastKey = this.keys.pop();
        const lastPrio = this.prios.pop();
        if (this.keys.length > 0) {
            this.keys[0] = lastKey;
            this.prios[0] = lastPrio;
            let i = 0;
            for (;;) {
                const l = i * 2 + 1, r = l + 1;
                let smallest = i;
                if (l < this.keys.length && this.prios[l] < this.prios[smallest]) smallest = l;
                if (r < this.keys.length && this.prios[r] < this.prios[smallest]) smallest = r;
                if (smallest === i) break;
                this._swap(i, smallest);
                i = smallest;
            }
        }
        return top;
    }
    _swap(a, b) {
        [this.keys[a], this.keys[b]] = [this.keys[b], this.keys[a]];
        [this.prios[a], this.prios[b]] = [this.prios[b], this.prios[a]];
    }
}
