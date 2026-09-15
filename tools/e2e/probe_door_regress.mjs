/** 一次性：回归——点门角色不走动、点地角色走动、点门后旋转正常 */
import puppeteer from 'puppeteer';

const base = process.argv[2] ?? 'http://127.0.0.1:8000';
const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
await page.emulate({
    viewport: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});
await page.goto(`${base}/index.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.waitForFunction(() => {
    const app = window.__app;
    return app && app.humanoid.userData.vrm && app.getDoors().length > 0;
}, { timeout: 180000, polling: 1000 });
await new Promise((r) => setTimeout(r, 1500));

const pos = () => page.evaluate(() => window.__app.humanoid.position.toArray().map(v => +v.toFixed(2)));

// 1) 点门：门开 + 角色原地不动
const doorPt = await page.evaluate(() => {
    const app = window.__app;
    for (let y = 100; y < innerHeight - 100; y += 20) {
        for (let x = 20; x < innerWidth - 20; x += 20) {
            const d = app.pickDoorAt(x, y);
            if (d && d.targetScene) return { x, y };
        }
    }
    return null;
});
console.log('门坐标:', JSON.stringify(doorPt), '初始位置:', JSON.stringify(await pos()));
await page.touchscreen.tap(doorPt.x, doorPt.y);
await new Promise((r) => setTimeout(r, 400));
const doorState = await page.evaluate(() =>
    window.__app.getDoors().filter(d => d.targetScene).map(d => d.targetT).join(','));
console.log('点门后 targetT:', doorState, '位置(应不变):', JSON.stringify(await pos()));

await new Promise((r) => setTimeout(r, 3000));   // 等切场景
console.log('场景:', await page.evaluate(() => window.__app.getActiveScene()));

// 2) 室内点地：角色应走动
await page.evaluate(() => window.__app.walkTo(2, 6));   // 先确认寻路可用
await new Promise((r) => setTimeout(r, 1500));
const p1 = await pos();
console.log('walkTo 后位置(应移动):', JSON.stringify(p1));

// 3) 点门进房间后单指旋转
const az = () => page.evaluate(() => {
    const c = window.__app;
    const t = c.controls.target, p = c.camera.position;
    return Math.atan2(p.x - t.x, p.z - t.z);
});
const b = await az();
await page.touchscreen.touchStart(195, 500);
for (let i = 1; i <= 10; i++) { await page.touchscreen.touchMove(195 + i * 12, 500); await new Promise(r => setTimeout(r, 30)); }
await page.touchscreen.touchEnd();
await new Promise((r) => setTimeout(r, 800));
console.log('室内拖动 Δaz =', ((await az()) - b).toFixed(3), '(应≠0)');
await browser.close();
