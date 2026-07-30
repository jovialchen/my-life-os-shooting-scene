/**
 * 端到端导航测试（阁楼）：用真实 models/island.glb + models/house.glb 建网，
 * 验证角色能从 2F 经第二跑白楼梯爬到阁楼，并走进阁楼房间内部。
 *
 * 坐标说明：GLB 为 three.js 坐标（y 向上；three z = -Blender y）
 * 第二跑白楼梯：北墙 three z≈-4.0，x -5.5..-0.8 爬升 3.17 -> 6.19，
 * 顶部平台东侧即阁楼楼板（x -0.51..3.66, y≈6.17）。
 *
 * 运行：node tools/test-nav-attic.mjs
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

const { walkable, obstacles } = parseGlbNodes(['models/island.glb', 'models/house.glb']);
const t0 = performance.now();
buildNavGrid({ walkable, obstacles });
rebuildDynamicObstacles([]); // 门全开
console.log(`建网耗时 ${Math.round(performance.now() - t0)}ms`);

const LEGS = [
    // 2F 中厅 -> 第二跑下口（井道西侧 2F 楼板，西翼条带）
    ['2F中厅 -> 第二跑下口', [0.0, 3.2, 0.0], [-5.7, 3.2, -4.0]],
    // 第二跑爬梯 -> 阁楼楼板（顶部平台东侧）
    ['第二跑爬梯 -> 阁楼楼板', [-5.7, 3.2, -4.0], [0.3, 6.2, -4.0]],
    // 阁楼楼板 -> 阁楼房间内部（屋脊下高净空区）
    ['阁楼楼板 -> 阁楼内部', [0.3, 6.2, -4.0], [0.0, 6.2, -1.0]],
    // 阁楼内部 -> 西翼阁楼（楼板连续，验证阁楼可走动范围）
    ['阁楼内部 -> 西翼阁楼', [0.0, 6.2, -1.0], [-5.0, 6.2, 1.0]],
];

for (const [name, a, b] of LEGS) {
    const path = findPath(new THREE.Vector3(...a), new THREE.Vector3(...b));
    check(name, Array.isArray(path) && path.length > 1,
        path ? `${path.length} 点, 终点 y=${path[path.length - 1].y.toFixed(2)}` : '不可达');
    if (!path) continue;
    let stepOk = true;
    for (let i = 1; i < path.length; i++) {
        if (Math.abs(path[i].y - path[i - 1].y) > 0.36) stepOk = false;
    }
    check('  相邻点高差 ≤ MAX_STEP', stepOk);
    if (name.includes('爬梯')) {
        // 楼梯段（x -5.6..-0.8 坡面区）高度应单调不降
        const onStairs = path.filter(p => p.x > -5.6 && p.x < -0.8);
        let mono = onStairs.length > 1;
        for (let i = 1; i < onStairs.length; i++) {
            if (onStairs[i].y < onStairs[i - 1].y - 0.01) mono = false;
        }
        check('  楼梯段高度单调上升', mono,
            `坡面 ${onStairs.length} 点, y ${onStairs[0]?.y.toFixed(2)} -> ${onStairs[onStairs.length - 1]?.y.toFixed(2)}`);
    }
}

// 基本检查：阁楼楼板可行走；阁楼屋脊区（避开 x≈0 屋架柱线）可行走
check('阁楼楼板可行走', isWalkableWorld(1.5, -4.0, 6.17));
check('阁楼屋脊区可行走', isWalkableWorld(0.0, -0.5, 6.17));

console.log(failures === 0 ? '\n全部通过' : `\n${failures} 项失败`);
process.exit(failures === 0 ? 0 : 1);
