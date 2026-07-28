/**
 * pathfinding.js 的 Node 冒烟测试（'three' 经 test-nav-loader.mjs 重定向到 three-stub.mjs）
 *
 * 场景：10x10 平地(y=0)，x=0 处一堵带门洞(z∈[-0.5,0.5])的墙，
 *       x∈[5,7] 是 0→2m 的斜坡楼梯，x∈[7,12] 是 2m 高的平台，
 *       (2,2) 处一个树干盒子障碍。
 *
 * 运行：node tools/test-nav.mjs
 */
import { register } from 'node:module';
register('./test-nav-loader.mjs', import.meta.url);

const THREE = await import('three');
const {
    buildNavGrid, rebuildDynamicObstacles, isWalkableWorld,
    groundHeightAt, findPath, smoothPath,
} = await import('../js/character/pathfinding.js');

let failures = 0;
function check(name, cond) {
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
    if (!cond) failures++;
}

/** 用三角形列表构造桩 mesh（世界坐标即局部坐标） */
function mesh(tris) {
    const arr = [];
    for (const t of tris) for (const v of t) arr.push(...v);
    const pos = {
        count: arr.length / 3,
        getX: (i) => arr[i * 3],
        getY: (i) => arr[i * 3 + 1],
        getZ: (i) => arr[i * 3 + 2],
    };
    return {
        geometry: { attributes: { position: pos }, index: null },
        matrixWorld: {},
        updateWorldMatrix() {},
    };
}

const quad = (a, b, c, d) => [[a, b, c], [a, c, d]];

// ── 场景 ──
const ground = mesh(quad([-5, 0, -5], [5, 0, -5], [5, 0, 5], [-5, 0, 5]));
const stairs = mesh(quad([5, 0, -1], [7, 2, -1], [7, 2, 1], [5, 0, 1]));
const upper  = mesh(quad([7, 2, -1], [12, 2, -1], [12, 2, 1], [7, 2, 1]));

const wallWest = mesh(quad([0, 0, -5], [0, 3, -5], [0, 3, -0.5], [0, 0, -0.5]));
const wallEast = mesh(quad([0, 0, 0.5], [0, 3, 0.5], [0, 3, 5], [0, 0, 5]));
const trunk = mesh([
    ...quad([1.8, 0, 1.8], [1.8, 3, 1.8], [1.8, 3, 2.2], [1.8, 0, 2.2]),
    ...quad([2.2, 0, 1.8], [2.2, 3, 1.8], [2.2, 3, 2.2], [2.2, 0, 2.2]),
    ...quad([1.8, 0, 1.8], [1.8, 3, 1.8], [2.2, 3, 1.8], [2.2, 0, 1.8]),
    ...quad([1.8, 0, 2.2], [1.8, 3, 2.2], [2.2, 3, 2.2], [2.2, 0, 2.2]),
]);

buildNavGrid({
    walkable: [ground, stairs, upper],
    obstacles: [wallWest, wallEast, trunk],
});

// ── 基本可行走性 ──
check('平地上的点可行走', isWalkableWorld(-2, -2, 0));
check('墙上的点被挡住', !isWalkableWorld(0, 3, 0));
check('门洞里可行走', isWalkableWorld(0, 0, 0));
check('树干位置被挡住', !isWalkableWorld(2, 2, 0));
check('网格范围外不可行走', !isWalkableWorld(100, 100, 0));

// ── 高度采样 ──
const midStairs = groundHeightAt(6, 0, 0.5);
check('楼梯中点高度≈1m', midStairs !== null && Math.abs(midStairs - 1) < 0.2);
const upperH = groundHeightAt(10, 0, 1.9);
check('平台高度≈2m', upperH !== null && Math.abs(upperH - 2) < 0.05);

// ── 平地寻路（穿门洞）──
const p1 = findPath(new THREE.Vector3(-3, 0, 0), new THREE.Vector3(3, 0, 0));
check('平地穿门洞有路径', Array.isArray(p1) && p1.length > 1);
if (p1) {
    const s1 = smoothPath(p1);
    check('路径平滑后仍有路径', s1.length >= 2);
    check('路径终点 y≈0', Math.abs(p1[p1.length - 1].y) < 0.05);
}

// ── 爬楼梯寻路（多层高度）──
const p2 = findPath(new THREE.Vector3(-3, 0, 0), new THREE.Vector3(10, 2, 0));
check('跨层寻路有路径（能上楼梯）', Array.isArray(p2) && p2.length > 1);
if (p2) {
    const endY = p2[p2.length - 1].y;
    check('路径终点高度≈2m', Math.abs(endY - 2) < 0.05);
    const maxY = Math.max(...p2.map(p => p.y));
    check('路径中间有爬升（max y > 1）', maxY > 1);
    // 相邻路径点高差不超过 MAX_STEP
    let stepOk = true;
    for (let i = 1; i < p2.length; i++) {
        if (Math.abs(p2[i].y - p2[i - 1].y) > 0.36) stepOk = false;
    }
    check('相邻路径点高差 ≤ MAX_STEP', stepOk);
}

// ── 动态障碍（关门后门洞堵死）──
const doorBox = new THREE.Box3();
doorBox.min.set(-0.2, 0, -0.6);
doorBox.max.set(0.2, 2.2, 0.6);
rebuildDynamicObstacles([doorBox]);
check('关门后门洞被堵', !isWalkableWorld(0, 0, 0));
const p3 = findPath(new THREE.Vector3(-3, 0, 0), new THREE.Vector3(3, 0, 0));
check('关门后穿墙路径不可达', p3 === null);

// 开门恢复
rebuildDynamicObstacles([]);
check('开门后门洞恢复', isWalkableWorld(0, 0, 0));

console.log(failures === 0 ? '\n全部通过' : `\n${failures} 项失败`);
process.exit(failures === 0 ? 0 : 1);
