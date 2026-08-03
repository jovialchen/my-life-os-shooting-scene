/** 全房间导航连通测试（阶段 5，仿 test-nav-room.mjs）：
 * 遍历 config.js SCENES 中所有带 glbs 的场景，逐房间建导航网格，断言：
 *   - 每个 spawn 落点本身可行走（不卡进家具）
 *   - default spawn ↔ 其余 spawn 双向可达（= 每扇门进来的落点都能走到其他门）
 *
 * 运行：node tools/test-nav-rooms.mjs
 */
import { register } from 'node:module';
register('./test-nav-loader.mjs', import.meta.url);

const THREE = await import('three');
const {
    buildNavGrid, rebuildDynamicObstacles, isWalkableWorld, findPath,
} = await import('../js/character/pathfinding.js');
const { parseGlbNodes } = await import('./nav-glb.mjs');
const { SCENES } = await import('../js/config.js');

let failures = 0;
function check(name, cond, extra = '') {
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + extra + ')' : ''}`);
    if (!cond) failures++;
}

for (const def of SCENES.filter((s) => s.glbs)) {
    const { walkable, obstacles } = parseGlbNodes(def.glbs);
    buildNavGrid({ walkable, obstacles });
    rebuildDynamicObstacles([]);   // 门全开（测连通，不测门挡）

    const spawns = Object.entries(def.spawns ?? {});
    console.log(`\n== ${def.id}（${walkable.length} 可行走面, ${obstacles.length} 障碍, ${spawns.length} 落点）==`);

    for (const [id, sp] of spawns) {
        check(`落点 ${id} 可行走`, isWalkableWorld(sp.pos[0], sp.pos[2], sp.pos[1] + 0.01),
            sp.pos.join(','));
    }

    const def2 = def.spawns?.default;
    if (!def2) continue;
    for (const [id, sp] of spawns) {
        if (id === 'default') continue;
        // 与 default 重合的落点（同一扇门的别名）跳过寻路
        if (Math.hypot(sp.pos[0] - def2.pos[0], sp.pos[2] - def2.pos[2]) < 0.05) continue;
        for (const [label, a, b] of [
            [`default -> ${id}`, def2.pos, sp.pos],
            [`${id} -> default`, sp.pos, def2.pos],
        ]) {
            const path = findPath(new THREE.Vector3(...a), new THREE.Vector3(...b));
            check(label, Array.isArray(path) && path.length > 1,
                path ? `${path.length} 点` : '不可达');
        }
    }
}

console.log(failures === 0 ? '\n全部通过' : `\n${failures} 项失败`);
process.exit(failures === 0 ? 0 : 1);
