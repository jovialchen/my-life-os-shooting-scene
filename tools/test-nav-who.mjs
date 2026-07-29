/** 排查哪个障碍物封了楼梯坡面 */
import { register } from 'node:module';
register('./test-nav-loader.mjs', import.meta.url);

const nav = await import('../js/character/pathfinding.js');
const { parseGlbNodes } = await import('./nav-glb.mjs');

const { walkable, obstacles } = parseGlbNodes(['models/island.glb', 'models/house.glb']);
console.log('障碍物:', obstacles.map(o => o.name).join(', '));

const TESTS = [
    ['全部障碍', obstacles],
    ['排除 STAIRS_01', obstacles.filter(o => o.name !== 'STAIRS_01')],
    ['仅 STAIRS_01', obstacles.filter(o => o.name === 'STAIRS_01')],
    ['排除 FLOOR_01', obstacles.filter(o => o.name !== 'FLOOR_01')],
    ['仅 FLOOR_01', obstacles.filter(o => o.name === 'FLOOR_01')],
    ['排除 WALL_01', obstacles.filter(o => o.name !== 'WALL_01')],
];
for (const [name, obs] of TESTS) {
    nav.buildNavGrid({ walkable, obstacles: obs });
    const h = nav.groundHeightAt(3.0, 2.5, 1.63);
    const h2 = nav.groundHeightAt(3.0, 4.2, 0.2);
    console.log(`${name}: (3.0,2.5)=${h === null ? 'NULL' : h.toFixed(2)}  (3.0,4.2)=${h2 === null ? 'NULL' : h2.toFixed(2)}`);
}
