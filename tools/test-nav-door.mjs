/** 翼门门洞逐点排查 */
import { register } from 'node:module';
register('./test-nav-loader.mjs', import.meta.url);

const nav = await import('../js/character/pathfinding.js');
const { parseGlbNodes } = await import('./nav-glb.mjs');

const { walkable, obstacles } = parseGlbNodes(['models/island.glb', 'models/house.glb']);

const PTS = [[6.0, 4.0], [6.2, 4.0], [6.4, 4.0], [6.5, 4.0], [6.6, 4.0], [6.8, 4.0], [7.0, 4.0]];
for (const [name, obs] of [
    ['全部', obstacles],
    ['仅WALL_01', obstacles.filter(o => o.name === 'WALL_01')],
    ['仅TRIM_01', obstacles.filter(o => o.name === 'TRIM_01')],
    ['仅FLOOR_01', obstacles.filter(o => o.name === 'FLOOR_01')],
]) {
    nav.buildNavGrid({ walkable, obstacles: obs });
    const out = PTS.map(([x, z]) => {
        const h = nav.groundHeightAt(x, z, 0.14);
        return `${x}:${h === null ? 'X' : h.toFixed(2)}`;
    });
    console.log(name, out.join(' '));
}
