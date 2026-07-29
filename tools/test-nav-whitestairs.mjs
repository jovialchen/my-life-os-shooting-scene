/** 调试白楼梯 WALK 坡面：沿坡采样地面高度 + 关键格高度层 */
import { register } from 'node:module';
register('./test-nav-loader.mjs', import.meta.url);

const nav = await import('../js/character/pathfinding.js');
const { parseGlbNodes } = await import('./nav-glb.mjs');

const { walkable, obstacles } = parseGlbNodes(['models/island.glb', 'models/house.glb']);
nav.buildNavGrid({ walkable, obstacles });
nav.rebuildDynamicObstacles([]);

// 坡面（three 坐标）：x -5.51..-0.83，z -4.76..-3.26，期望 y 0.146 -> 3.14
console.log('沿坡面中线 (z=-4.0) 采样:');
for (let x = -5.6; x <= -0.5; x += 0.25) {
    const expect = 0.146 + (x + 5.51) * (3.14 - 0.146) / 4.68;
    const h = nav.groundHeightAt(x, -4.0, expect);
    console.log(`x=${x.toFixed(2)} 期望≈${expect.toFixed(2)} 实测=${h === null ? 'NULL' : h.toFixed(2)}`);
}
console.log('\n关键格高度层:');
for (const [x, z] of [[-5.5, -4.0], [-4.0, -4.0], [-2.5, -4.0],
                      [-1.0, -4.0], [-0.7, -4.0], [-0.6, -4.0]]) {
    console.log(`(${x}, ${z}):`, nav.debugLevelsAt(x, z).map(v => v.toFixed(2)).join(' '));
}
