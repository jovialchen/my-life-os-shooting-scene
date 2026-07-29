/** 排查哪个障碍物封了楼梯井（A段中点/平台/2F到达点） */
import { register } from 'node:module';
register('./test-nav-loader.mjs', import.meta.url);

const nav = await import('../js/character/pathfinding.js');
const { parseGlbNodes } = await import('./nav-glb.mjs');

const { walkable, obstacles } = parseGlbNodes(['models/island.glb', 'models/house.glb']);

const POINTS = [
    ['A段中点 (-1.0, 1.0, -4.0)', [-1.0, 1.0, -4.0]],
    ['平台 (-1.0, 1.6, -4.7)', [-1.0, 1.6, -4.7]],
    ['B段中点 (-1.0, 2.4, -4.0)', [-1.0, 2.4, -4.0]],
    ['2F到达 (-1.0, 3.18, -3.35)', [-1.0, 3.18, -3.35]],
];
for (const [name, obs] of [
    ['全部障碍', obstacles],
    ['排除 STAIRS_01', obstacles.filter(o => o.name !== 'STAIRS_01')],
    ['仅 STAIRS_01', obstacles.filter(o => o.name === 'STAIRS_01')],
    ['排除 WALL_01', obstacles.filter(o => o.name !== 'WALL_01')],
    ['排除 FLOOR_01', obstacles.filter(o => o.name !== 'FLOOR_01')],
]) {
    nav.buildNavGrid({ walkable, obstacles: obs });
    const out = POINTS.map(([n, p]) => {
        const h = nav.groundHeightAt(p[0], p[2], p[1]);
        return `${n}=${h === null ? 'NULL' : h.toFixed(2)}`;
    });
    console.log(name, '\n   ', out.join('  '));
}
