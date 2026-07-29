import { register } from 'node:module';
register('./test-nav-loader.mjs', import.meta.url);
const { parseGlbNodes } = await import('./nav-glb.mjs');
const { walkable } = parseGlbNodes(['models/house.glb']);
// 找覆盖 (x 0.0, z -4.1) 附近、y≈3.18 的 walkable 三角形
for (const m of walkable) {
    const pos = m.geometry.attributes.position;
    const idx = m.geometry.index;
    const n = idx ? idx.count : pos.count;
    for (let i = 0; i < n; i += 3) {
        const tri = [0, 1, 2].map(k => {
            const vi = idx ? idx.getX(i + k) : i + k;
            return [pos.getX(vi), pos.getY(vi), pos.getZ(vi)];
        });
        const xs = tri.map(v => v[0]), ys = tri.map(v => v[1]), zs = tri.map(v => v[2]);
        if (Math.min(...xs) > 0.3 || Math.max(...xs) < -0.3) continue;
        if (Math.min(...zs) > -3.8 || Math.max(...zs) < -4.4) continue;
        if (Math.min(...ys) > 3.4 || Math.max(...ys) < 3.0) continue;
        console.log(m.name, JSON.stringify(tri.map(v => v.map(x => +x.toFixed(2)))));
    }
}
