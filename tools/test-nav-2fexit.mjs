import { register } from 'node:module';
register('./test-nav-loader.mjs', import.meta.url);
const nav = await import('../js/character/pathfinding.js');
const { parseGlbNodes } = await import('./nav-glb.mjs');
const { walkable, obstacles } = parseGlbNodes(['models/island.glb', 'models/house.glb']);
nav.buildNavGrid({ walkable, obstacles });
nav.rebuildDynamicObstacles([]);
// 每格显示 >2.8 的最高层高度（一位数字≈米），'.' 无高层
for (let z = -2.8; z >= -5.3; z -= 0.1) {
    let row = `z=${z.toFixed(1)} `;
    for (let x = -1.6; x <= 1.6; x += 0.1) {
        const lv = nav.debugLevelsAt(x, z).filter(h => h > 2.8);
        row += lv.length ? Math.round(Math.max(...lv)).toString(36) : '.';
    }
    console.log(row + '  x -1.6..1.6');
}
console.log('\n散点:');
for (const [x, z] of [[0, -4.1], [0.5, -4.3], [1.0, -4.5], [0.3, -5.0], [0.8, -5.0],
                      [-0.4, -5.0], [-0.8, -5.0], [-1.2, -5.0], [1.3, -5.0]]) {
    console.log(`(${x}, ${z}):`, nav.debugLevelsAt(x, z).map(v => v.toFixed(2)).join(' '));
}
