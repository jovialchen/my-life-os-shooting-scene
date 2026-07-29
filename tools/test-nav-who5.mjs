/** 逐障碍排查三个失败点 */
import { register } from 'node:module';
register('./test-nav-loader.mjs', import.meta.url);

const nav = await import('../js/character/pathfinding.js');
const { parseGlbNodes } = await import('./nav-glb.mjs');

const { walkable, obstacles } = parseGlbNodes(['models/island.glb', 'models/house.glb']);

const POINTS = [
    ['A顶', [-1.2, 1.4, -3.1]],
    ['平台', [-1.0, 1.45, -3.35]],
    ['楼板B/C', [0.5, 3.18, -3.25]],
];
const NAMES = [...new Set(obstacles.map(o => o.name.split('_')[0]))];
console.log('障碍类别:', NAMES.join(','));

for (const n of NAMES) {
    const obs = obstacles.filter(o => o.name.split('_')[0] === n);
    nav.buildNavGrid({ walkable, obstacles: obs });
    const out = POINTS.map(([label, p]) => {
        const h = nav.groundHeightAt(p[0], p[2], p[1]);
        return `${label}=${h === null ? 'X' : 'ok'}`;
    });
    console.log(`仅${n}:`, out.join('  '));
}
