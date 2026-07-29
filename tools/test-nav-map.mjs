/** 导航网格 ASCII 可视化：node tools/test-nav-map.mjs [y] */
import { register } from 'node:module';
register('./test-nav-loader.mjs', import.meta.url);

const THREE = await import('three');
const nav = await import('../js/character/pathfinding.js');
const { parseGlbNodes } = await import('./nav-glb.mjs');

const { walkable, obstacles: allObstacles } = parseGlbNodes(['models/island.glb', 'models/house.glb']);
const filter = process.env.OBST_FILTER;
const obstacles = filter ? allObstacles.filter(o => o.name === filter) : allObstacles;
nav.buildNavGrid({ walkable, obstacles });
nav.rebuildDynamicObstacles([]);

const y = parseFloat(process.argv[2] ?? '0.1');
const x0 = parseFloat(process.argv[3] ?? '-10');
const x1 = parseFloat(process.argv[4] ?? '10');
const z0 = parseFloat(process.argv[5] ?? '-8');
const z1 = parseFloat(process.argv[6] ?? '12');
const step = parseFloat(process.argv[7] ?? '0.4');
for (let z = z1; z >= z0; z -= step) {
    let row = '';
    for (let x = x0; x <= x1; x += step) {
        row += nav.isWalkableWorld(x, z, y) ? '.' : '#';
    }
    console.log(z.toFixed(2).padStart(6), row);
}
const h = nav.groundHeightAt(0, 0.5, 0.1);
console.log('groundHeightAt(0,0.5,0.1) =', h);
