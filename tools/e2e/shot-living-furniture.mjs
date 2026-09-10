/** 客厅家具 + 人物比例对照截图：人物传送到沙发旁，近机位看沙发组
 * 用法: node tools/e2e/shot-living-furniture.mjs <baseUrl>
 * 产出: temp/living_furniture.png
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

await page.goto(`${base}/index.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => {
    const app = window.__app;
    return app && app.humanoid.userData.vrm && app.getDoors().length > 0;
}, { timeout: 60000 });
await new Promise((r) => setTimeout(r, 1500));

await page.evaluate(() => window.__app.switchTo('f1_living'));
await page.waitForFunction(() => window.__app.getActiveScene() === 'f1_living', { timeout: 15000 });
await new Promise((r) => setTimeout(r, 1200));

// 人物站到沙发正前方面朝沙发（-x），相机从东北低机位看沙发组
await page.evaluate(() => {
    const app = window.__app;
    app.teleport(-1.2, 0.02, 7.0, -Math.PI / 2);
    app.controls.maxPolarAngle = Math.PI * 0.55;
    app.camera.position.set(0.2, 1.6, 9.8);
    app.controls.target.set(-3.2, 0.7, 6.8);
    app.controls.update();
});
await new Promise((r) => setTimeout(r, 900));
await page.screenshot({ path: 'temp/living_furniture.png' });
console.log('shot living_furniture');

await browser.close();
