/** 一次性：模拟手机触屏，验证室外/室内单指拖动能否旋转相机 */
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
page.on('console', (m) => { if (m.type() === 'error') console.log('[page-err]', m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`${base}/index.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => {
    const app = window.__app;
    return app && app.humanoid.userData.vrm && app.getDoors().length > 0;
}, { timeout: 60000 });
await new Promise((r) => setTimeout(r, 1500));

async function dragAndMeasure(label) {
    const before = await page.evaluate(() => {
        const c = window.__app;
        const t = c.controls.target, p = c.camera.position;
        return Math.atan2(p.x - t.x, p.z - t.z);
    });
    await page.touchscreen.touchStart(195, 400);
    for (let i = 1; i <= 10; i++) {
        await page.touchscreen.touchMove(195 + i * 12, 400);
        await new Promise((r) => setTimeout(r, 30));
    }
    await page.touchscreen.touchEnd();
    await new Promise((r) => setTimeout(r, 800));   // 阻尼收敛
    const after = await page.evaluate(() => {
        const c = window.__app;
        const t = c.controls.target, p = c.camera.position;
        return {
            az: Math.atan2(p.x - t.x, p.z - t.z),
            enabled: c.controls.enabled,
            dist: p.distanceTo(t),
            scene: c.getActiveScene(),
            zone: c.camZones.currentZone?.id,
        };
    });
    console.log(`${label}: az ${before.toFixed(3)} -> ${after.az.toFixed(3)} (Δ=${(after.az - before).toFixed(3)})`,
        JSON.stringify({ enabled: after.enabled, dist: +after.dist.toFixed(2), scene: after.scene, zone: after.zone }));
}

await dragAndMeasure('室外');
await page.evaluate(() => window.__app.switchTo('f1_living'));
await new Promise((r) => setTimeout(r, 2000));
await dragAndMeasure('客厅');
await page.evaluate(() => window.__app.switchTo('f2_bed1'));
await new Promise((r) => setTimeout(r, 2000));
await dragAndMeasure('卧室1');
await browser.close();
