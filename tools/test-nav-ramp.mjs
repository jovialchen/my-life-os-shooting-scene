/** 沿一段楼梯 WALK 斜坡采样地面高度 */
import { register } from 'node:module';
register('./test-nav-loader.mjs', import.meta.url);

const nav = await import('../js/character/pathfinding.js');
const { parseGlbNodes } = await import('./nav-glb.mjs');

const { walkable, obstacles } = parseGlbNodes(['models/island.glb', 'models/house.glb']);
const noObstacles = process.argv.includes('--no-obstacles');
nav.buildNavGrid({ walkable, obstacles: noObstacles ? [] : obstacles });
nav.rebuildDynamicObstacles([]);

console.log('沿一段楼梯（x=3.0, z 4.3→0.7）采样:');
for (let z = 4.3; z >= 0.7; z -= 0.2) {
    const expect = 0.06 + (4.3 - z) / 3.55 * 3.1;
    const h = nav.groundHeightAt(3.0, z, expect);
    console.log(`z=${z.toFixed(1)} 期望≈${expect.toFixed(2)} 实测=${h === null ? 'NULL' : h.toFixed(2)}`);
}
