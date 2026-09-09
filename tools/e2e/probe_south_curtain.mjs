/** 调试：南墙窗帘的包围盒与射线命中 */
import puppeteer from 'puppeteer';

const base = process.argv[2] ?? 'http://127.0.0.1:8132';
const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
page.on('pageerror', (e) => console.log('pageerror:', e.message));
await page.goto(`${base}/index.html`, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => {
    const app = window.__app;
    return app && app.humanoid.userData.vrm && app.getDoors().length > 0;
}, { timeout: 60000 });
await new Promise((r) => setTimeout(r, 1500));
await page.evaluate(() => window.__app.switchTo('f1_living'));
await page.waitForFunction(() =>
    window.__app.getDoors().some((d) => d.kind === 'curtain' && d.obj.name.includes('south')), { timeout: 30000 });
await new Promise((r) => setTimeout(r, 1500));

await page.evaluate(() => {
    const { camera, controls } = window.__app;
    camera.position.set(0, 2.2, 9.5);
    controls.target.set(0, 1.1, 0);
    controls.update();
});
await new Promise((r) => setTimeout(r, 600));

const info = await page.evaluate(() => {
    const { camera } = window.__app;
    const V3 = camera.position.constructor;
    const out = [];
    for (const d of window.__app.getDoors()) {
        if (!d.obj.name.includes('south')) continue;
        // 世界包围盒
        const min = new V3(Infinity, Infinity, Infinity), max = new V3(-Infinity, -Infinity, -Infinity);
        d.obj.updateWorldMatrix(true, true);
        d.obj.traverse((c) => {
            if (!c.isMesh) return;
            c.geometry.computeBoundingBox();
            const bb = c.geometry.boundingBox;
            for (const cx of [bb.min.x, bb.max.x]) for (const cy of [bb.min.y, bb.max.y]) for (const cz of [bb.min.z, bb.max.z]) {
                const v = c.localToWorld(new V3(cx, cy, cz));
                min.min(v); max.max(v);
            }
        });
        // 中心点投影 + pickDoorAt
        const c = new V3((min.x + max.x) / 2, (min.y + max.y) / 2, (min.z + max.z) / 2);
        const p = c.clone().project(camera);
        const sx = (p.x * 0.5 + 0.5) * innerWidth, sy = (-p.y * 0.5 + 0.5) * innerHeight;
        const hit = window.__app.pickDoorAt(sx, sy);
        out.push({
            name: d.obj.name,
            min: min.toArray().map((v) => +v.toFixed(2)),
            max: max.toArray().map((v) => +v.toFixed(2)),
            screen: [Math.round(sx), Math.round(sy)],
            behind: p.z > 1,
            hit: hit ? hit.obj.name : null,
        });
    }
    return out;
});
console.log(JSON.stringify(info, null, 1));

// 真实点击 CURTAIN_L_south_0 中心，验证 pointer 事件链路
const states = () => page.evaluate(() =>
    window.__app.getDoors().filter((d) => d.kind === 'curtain')
        .map((d) => `${d.obj.name}:${d.openT.toFixed(2)}→${d.targetT}`));
const l0 = info.find((i) => i.name === 'CURTAIN_L_south_0');
console.log('click at', l0.screen, 'before:', (await states()).join(' '));
await page.mouse.click(l0.screen[0], l0.screen[1]);
await new Promise((r) => setTimeout(r, 1200));
console.log('after:', (await states()).join(' '));
await browser.close();
