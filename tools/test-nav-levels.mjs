/** 打印平台区域格子的层数据（对比 无障碍 / 仅WALL_01） */
import { register } from 'node:module';
register('./test-nav-loader.mjs', import.meta.url);

const nav = await import('../js/character/pathfinding.js');
const { parseGlbNodes } = await import('./nav-glb.mjs');

const { walkable, obstacles } = parseGlbNodes(['models/island.glb', 'models/house.glb']);

for (const [name, obs] of [
    ['无障碍', []],
    ['仅WALL_01', obstacles.filter(o => o.name === 'WALL_01')],
]) {
    nav.buildNavGrid({ walkable, obstacles: obs });
    console.log(`== ${name} ==`);
    for (const [x, z] of [[-1.0, -3.35], [-1.2, -3.1], [-1.0, -3.2], [-0.7, -3.35], [-1.4, -3.35]]) {
        console.log(`  (${x}, ${z}):`, nav.debugLevelsAt(x, z).map(h => h.toFixed(2)).join(', ') || 'EMPTY');
    }
}
