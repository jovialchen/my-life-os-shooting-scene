/** 翼房间内部的连通性 + 路径打印 */
import { register } from 'node:module';
register('./test-nav-loader.mjs', import.meta.url);

const THREE = await import('three');
const nav = await import('../js/character/pathfinding.js');
const { parseGlbNodes } = await import('./nav-glb.mjs');

const { walkable, obstacles } = parseGlbNodes(['models/island.glb', 'models/house.glb']);
nav.buildNavGrid({ walkable, obstacles });
nav.rebuildDynamicObstacles([]);

const p = nav.findPath(new THREE.Vector3(5.5, 3.2, 3.5), new THREE.Vector3(0, 3.2, 0));
if (!p) {
    console.log('翼房间 -> 中厅2F: 不可达');
} else {
    console.log(`翼房间 -> 中厅2F: ${p.length} 点`);
    for (let i = 0; i < p.length; i += 4) {
        console.log(`  (${p[i].x.toFixed(1)}, ${p[i].y.toFixed(2)}, ${p[i].z.toFixed(1)})`);
    }
}
