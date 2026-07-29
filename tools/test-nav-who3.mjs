/** 仅 STAIRS_01 时沿 A/B 段的高度采样 */
import { register } from 'node:module';
register('./test-nav-loader.mjs', import.meta.url);

const nav = await import('../js/character/pathfinding.js');
const { parseGlbNodes } = await import('./nav-glb.mjs');

const { walkable, obstacles } = parseGlbNodes(['models/island.glb', 'models/house.glb']);
const stairs = obstacles.filter(o => o.name === 'STAIRS_01');
nav.buildNavGrid({ walkable, obstacles: stairs });

console.log('z(three) -> groundHeight（期望 A 段 0.06→1.6 / 平台1.62 / B段1.6→3.18）');
for (let z = -3.2; z >= -5.0; z -= 0.1) {
    const h = nav.groundHeightAt(-1.0, z, 2.0);
    process.stdout.write(`${z.toFixed(1)}:${h === null ? 'NULL' : h.toFixed(2)}  `);
}
console.log();
