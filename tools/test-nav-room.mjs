/** 房间导航测试（阶段 3.2，仿 test-nav-real.mjs）：
 * 加载 models/room_living.glb 建导航网格，断言 spawn → 房内各点可达、
 * 楼梯可行走（WALK_stairs 多层）、梯下空间不可走。
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

// 房间坐标：原点在门口地板中心，10×12（x±5, z 0..12），地板 y≈0.015
// 楼梯沿东墙（x 4.1..5.0, z 5.9→10.66）爬升到 y=3.0 平台
const SPAWN = [0, 0.02, 0.9];   // config.js SCENES f1_living spawns.default
const LEGS = [
    ['spawn -> 西南角', SPAWN, [-4.3, 0.02, 1.2]],
    ['spawn -> 东南角', SPAWN, [4.3, 0.02, 2.0]],
    ['spawn -> 北窗前', SPAWN, [-2.05, 0.02, 10.5]],
    ['spawn -> 楼梯底', SPAWN, [4.5, 0.02, 5.0]],
    // 一路爬上楼梯到顶平台（fromStudy 落点，在传送触发区外）
    ['spawn -> 楼梯顶平台', SPAWN, [4.55, 3.03, 10.9]],
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

check('地板可行走', isWalkableWorld(-1.0, 6.0, 0.02));
check('楼梯中段可行走（第9步 y≈1.6）', isWalkableWorld(4.5, 8.2, 1.6));
check('顶平台可行走（y≈3.0）', isWalkableWorld(4.5, 11.5, 3.03));
check('梯下空间不可走（楼梯带地面层无 WALK 面）', !isWalkableWorld(4.5, 7.5, 0.02));
check('楼梯带西侧边缘外不可走（x<4.0 无楼梯 WALK 面高层）', !isWalkableWorld(3.9, 8.2, 1.6));

console.log(failures === 0 ? '\n全部通过' : `\n${failures} 项失败`);
process.exit(failures === 0 ? 0 : 1);
