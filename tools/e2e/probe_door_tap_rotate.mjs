/** 一次性：复现「点门进房间后无法旋转」——直接点门→切场景→拖动测方位角 */
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
await page.goto(`${base}/index.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => {
    const app = window.__app;
    return app && app.humanoid.userData.vrm && app.getDoors().length > 0;
}, { timeout: 60000 });
await new Promise((r) => setTimeout(r, 1500));

const doorPt = await page.evaluate(() => {
    const app = window.__app;
    for (let y = 100; y < innerHeight - 100; y += 20) {
        for (let x = 20; x < innerWidth - 20; x += 20) {
            const d = app.pickDoorAt(x, y);
            if (d && d.targetScene) return { x, y, scene: d.targetScene };
        }
    }
    return null;
});
console.log('传送门屏幕坐标:', JSON.stringify(doorPt));

async function dragAz(label) {
    const before = await page.evaluate(() => {
        const c = window.__app;
        const t = c.controls.target, p = c.camera.position;
        return Math.atan2(p.x - t.x, p.z - t.z);
    });
    await page.touchscreen.touchStart(195, 500);
    for (let i = 1; i <= 10; i++) {
        await page.touchscreen.touchMove(195 + i * 12, 500);
        await new Promise((r) => setTimeout(r, 30));
    }
    await page.touchscreen.touchEnd();
    await new Promise((r) => setTimeout(r, 800));
    const after = await page.evaluate(() => {
        const c = window.__app;
        const t = c.controls.target, p = c.camera.position;
        return { az: Math.atan2(p.x - t.x, p.z - t.z), scene: c.getActiveScene(), enabled: c.controls.enabled };
    });
    console.log(`${label}: Δaz=${(after.az - before).toFixed(3)} scene=${after.scene} enabled=${after.enabled}`);
}

if (doorPt) {
    await page.touchscreen.tap(doorPt.x, doorPt.y);
    await new Promise((r) => setTimeout(r, 500));
    console.log('点门后 scene =', await page.evaluate(() => window.__app.getActiveScene()));
    await new Promise((r) => setTimeout(r, 3000));   // 等切场景+加载
    console.log('稳定后 scene =', await page.evaluate(() => window.__app.getActiveScene()));
    await dragAz('点门后第1次拖动');
    await dragAz('点门后第2次拖动');
    await dragAz('点门后第3次拖动');
}
await browser.close();
