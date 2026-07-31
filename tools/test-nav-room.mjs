/** 房间导航测试（阶段 3.2，仿 test-nav-real.mjs）：
 * 加载 models/room_living.glb 建导航网格，断言 spawn → 房内各点可达、
 * 家具下方不可走、地毯（nav_ignore）不影响行走。
 *
 * 运行：node tools/test-nav-room.mjs
 */
import { register } from 'node:module';
register('./test-nav-loader.mjs', import.meta.url);

const THREE = await import('three');
const {
    buildNavGrid, rebuildDynamicObstacles, isWalkableWorld, findPath,
} = await import('../js/character/pathfinding.js');
const { parseGlbNodes } = await import('./nav-glb.mjs');

let failures = 0;
function check(name, cond, extra = '') {
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + extra + ')' : ''}`);
    if (!cond) failures++;
}

const { walkable, obstacles } = parseGlbNodes(['models/room_living.glb']);
console.log(`walkable: ${walkable.map(m => m.name).join(', ')}`);
console.log(`obstacles: ${obstacles.map(m => m.name).join(', ')}`);

buildNavGrid({ walkable, obstacles });
rebuildDynamicObstacles([]);

// 房间坐标：原点在门口地板中心，x±3, z 0..5，地板 y≈0.015
const SPAWN = [0, 0.02, 0.9];   // config.js SCENES f1_living spawns.default
const LEGS = [
    ['spawn -> 西南角', SPAWN, [-2.3, 0.02, 1.2]],
    ['spawn -> 东南角', SPAWN, [2.3, 0.02, 2.2]],
    ['spawn -> 北窗前', SPAWN, [0.5, 0.02, 4.55]],
    ['spawn -> 沙发前', SPAWN, [-1.2, 0.02, 3.6]],
];
for (const [name, a, b] of LEGS) {
    const path = findPath(new THREE.Vector3(...a), new THREE.Vector3(...b));
    check(name, Array.isArray(path) && path.length > 1,
        path ? `${path.length} 点, 终点 y=${path[path.length - 1].y.toFixed(2)}` : '不可达');
    if (path) {
        let stepOk = true;
        for (let i = 1; i < path.length; i++) {
            if (Math.abs(path[i].y - path[i - 1].y) > 0.36) stepOk = false;
        }
        check('  相邻点高差 ≤ MAX_STEP', stepOk);
    }
}

check('地毯上可行走（nav_ignore）', isWalkableWorld(-0.2, 2.8, 0.02));
check('沙发座面处不可走（障碍）', !isWalkableWorld(-2.2, 3.7, 0.02));
check('电视柜处不可走（障碍）', !isWalkableWorld(2.6, 3.7, 0.02));

console.log(failures === 0 ? '\n全部通过' : `\n${failures} 项失败`);
process.exit(failures === 0 ? 0 : 1);
