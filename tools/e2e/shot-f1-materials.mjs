/** 一楼 4 房间 × 全部机位截图（材质巡检用）
 * 用法: node tools/e2e/shot-f1-materials.mjs <baseUrl>
 * 产出: temp/mat_<scene>_<zone>.png
 */
import puppeteer from 'puppeteer';

const base = process.argv[2] ?? 'http://127.0.0.1:8000';
const F1 = ['f1_living', 'f1_corridor', 'f1_kitchen', 'f1_bath'];

const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
page.on('pageerror', (e) => console.log('pageerror:', e.message));
await page.goto(`${base}/index.html`, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__app?.humanoid.userData.vrm && window.__app.getDoors().length > 0, { timeout: 60000 });
await new Promise((r) => setTimeout(r, 1500));

for (const sceneId of F1) {
    await page.evaluate((s) => window.__app.switchTo(s), sceneId);
    await page.waitForFunction((s) => window.__app.getActiveScene() === s, { timeout: 15000 }, sceneId);
    await new Promise((r) => setTimeout(r, 1200));
    const zones = await page.evaluate((s) => {
        const def = window.__app.config.SCENES.find((x) => x.id === s);
        return def.zones.map((z) => z.id);
    }, sceneId);
    for (const zoneId of zones) {
        await page.evaluate((s, zid) => {
            const def = window.__app.config.SCENES.find((x) => x.id === s);
            const z = def.zones.find((zz) => zz.id === zid);
            window.__app.camZones.goToZone(z, true);
        }, sceneId, zoneId);
        await new Promise((r) => setTimeout(r, 800));
        await page.screenshot({ path: `temp/mat_${sceneId}_${zoneId}.png` });
        console.log(`shot mat_${sceneId}_${zoneId}`);
    }
}
await browser.close();
