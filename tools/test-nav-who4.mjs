/** 排查平台/A段顶/B段各点的障碍来源 */
import { register } from 'node:module';
register('./test-nav-loader.mjs', import.meta.url);

const nav = await import('../js/character/pathfinding.js');
const { parseGlbNodes } = await import('./nav-glb.mjs');

const { walkable, obstacles } = parseGlbNodes(['models/island.glb', 'models/house.glb']);

const POINTS = [
    ['A段顶 (-1.0, 1.5, -3.2)', [-1.0, 1.5, -3.2]],
    ['平台 (-1.0, 1.55, -3.35)', [-1.0, 1.55, -3.35]],
    ['B段中 (-1.0, 2.3, -4.2)', [-1.0, 2.3, -4.2]],
    ['B段顶 (-1.0, 3.1, -4.8)', [-1.0, 3.1, -4.8]],
    ['楼板B (0.0, 3.18, -4.5)', [0.0, 3.18, -4.5]],
];
for (const [name, obs] of [
    ['全部障碍', obstacles],
    ['排除 STAIRS_01', obstacles.filter(o => o.name !== 'STAIRS_01')],
    ['仅 STAIRS_01', obstacles.filter(o => o.name === 'STAIRS_01')],
    ['排除 FLOOR_01', obstacles.filter(o => o.name !== 'FLOOR_01')],
    ['排除 WALL_01', obstacles.filter(o => o.name !== 'WALL_01')],
    ['排除 ROOF_01', obstacles.filter(o => o.name !== 'ROOF_01')],
]) {
    nav.buildNavGrid({ walkable, obstacles: obs });
    const out = POINTS.map(([n, p]) => {
        const h = nav.groundHeightAt(p[0], p[2], p[1]);
        return `${n.split(' ')[0]}=${h === null ? 'NULL' : h.toFixed(2)}`;
    });
    console.log(name, '\n   ', out.join('  '));
}
