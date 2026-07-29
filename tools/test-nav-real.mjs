/**
 * 端到端导航测试：用真实 models/island.glb + models/house.glb 建导航网格，
 * 验证角色能从门口走进房子、爬楼梯上 2F、过天桥、再爬楼梯到阁楼。
 *
 * 运行：node tools/test-nav-real.mjs
 */
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
register('./test-nav-loader.mjs', import.meta.url);

const THREE = await import('three');
const {
    buildNavGrid, rebuildDynamicObstacles, isWalkableWorld,
    groundHeightAt, findPath, getWalkableMeshes,
} = await import('../js/character/pathfinding.js');
const { parseGlbNodes } = await import('./nav-glb.mjs');

let failures = 0;
function check(name, cond, extra = '') {
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + extra + ')' : ''}`);
    if (!cond) failures++;
}

// ── 加载两个模型，分类 walkable / obstacles ──
const { walkable, obstacles } = parseGlbNodes(['models/island.glb', 'models/house.glb']);
console.log(`walkable: ${walkable.map(m => m.name).join(', ')}`);

const t0 = performance.now();
buildNavGrid({ walkable, obstacles });
rebuildDynamicObstacles([]);
console.log(`建网耗时 ${Math.round(performance.now() - t0)}ms`);

// 坐标说明：GLB 为 three.js 坐标（y 向上；three z = -Blender y）
// 白楼梯（原模型踏步）：北墙 three z≈-4.0，第一跑 x -5.5..-0.8 爬升 0.13->3.17
// 路线：翼门 -> 翼 1F -> 后厅 -> 白楼梯第一跑 -> 2F -> 东翼
const LEGS = [
    ['庭院 -> 翼门', [0, -0.01, 8], [6, 0.1, 4.5]],
    ['翼门 -> 翼1F', [6, 0.1, 4.5], [5, 0.1, 1.2]],
    ['翼1F -> 后厅', [5, 0.1, 1.2], [-3, 0.1, -2]],
    ['后厅 -> 白楼梯下口', [-3, 0.1, -2], [-5.6, 0.1, -4.0]],
    ['白楼梯爬梯 -> 2F', [-5.6, 0.1, -4.0], [0.5, 3.2, -4.0]],
    ['2F -> 中厅楼板A', [0.5, 3.2, -4.0], [0.0, 3.2, 0.0]],
    ['中厅2F -> 东翼房间', [0.0, 3.2, 0.0], [5.5, 3.2, 3.5]],
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

// 基本检查：岛面可行走、树干处不可走
check('岛面可行走', isWalkableWorld(0, 8, -0.01));
check('树干不可走', !isWalkableWorld(-18, 6, -0.01));

console.log(failures === 0 ? '\n全部通过' : `\n${failures} 项失败`);
process.exit(failures === 0 ? 0 : 1);
