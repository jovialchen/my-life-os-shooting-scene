/** 分段调试 庭院->后厅 */
import { register } from 'node:module';
register('./test-nav-loader.mjs', import.meta.url);

const THREE = await import('three');
const nav = await import('../js/character/pathfinding.js');
const { parseGlbNodes } = await import('./nav-glb.mjs');

const { walkable, obstacles } = parseGlbNodes(['models/island.glb', 'models/house.glb']);
nav.buildNavGrid({ walkable, obstacles });
nav.rebuildDynamicObstacles([]);

const legs = [
    ['庭院->门廊 (0,8)->(0,4.5)', [0, -0.01, 8], [0, 0.1, 4.5]],
    ['门廊->翼门外 (0,4.5)->(6,4.5)', [0, 0.1, 4.5], [6, 0.1, 4.5]],
    ['绕南 (0,8)->(6,6)', [0, -0.01, 8], [6, -0.01, 6]],
    ['南->翼门外 (6,6)->(6,4.5)', [6, -0.01, 6], [6, 0.1, 4.5]],
];
for (const [name, a, b] of legs) {
    const p = nav.findPath(new THREE.Vector3(...a), new THREE.Vector3(...b));
    console.log(name, p ? `OK ${p.length}点` : 'FAIL');
}
