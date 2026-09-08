/** 楼梯行走实测：进客厅 → walkTo 楼梯顶平台，采样位置看是否卡住；再 walkTo 回门口
 * 用法: node tools/e2e/probe_stair_walk.mjs <baseUrl>
 */
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
await page.waitForFunction(() => window.__app?.humanoid.userData.vrm && window.__app.getDoors().length > 0, { timeout: 60000 });
await new Promise((r) => setTimeout(r, 1000));
await page.evaluate(() => window.__app.switchTo('f1_living'));
await page.waitForFunction(() => window.__app.getActiveScene() === 'f1_living' && window.__app.getDoors().length === 3, { timeout: 15000 });
await new Promise((r) => setTimeout(r, 800));

async function sample(n, dtMs, tag) {
    for (let i = 0; i < n; i++) {
        const s = await page.evaluate(() => ({
            pos: window.__app.humanoid.position.toArray().map((v) => +v.toFixed(2)),
            scene: window.__app.getActiveScene(),
        }));
        console.log(`${tag} pos=${s.pos.join(',')} scene=${s.scene}`);
        await new Promise((r) => setTimeout(r, dtMs));
    }
}
console.log('— 上楼 —');
await page.evaluate(() => window.__app.walkTo(4.55, 10.9, 3.03));
await sample(10, 1200, 'up ');
console.log('— 下楼回门口 —');
await page.evaluate(() => window.__app.walkTo(0, 0.9, 0.02));
await sample(10, 1200, 'dn ');
await page.screenshot({ path: 'temp/stair_walk.png' });
await browser.close();
