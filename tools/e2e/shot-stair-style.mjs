/** 楼梯配色方案对比截图（默认机位 + 楼梯特写）
 * 用法: node tools/e2e/shot-stair-style.mjs <baseUrl> <输出名>
 */
import puppeteer from 'puppeteer';
const base = process.argv[2] ?? 'http://127.0.0.1:8132';
const name = process.argv[3] ?? 'stair_style';
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
page.on('pageerror', (e) => console.log('pageerror:', e.message));
await page.goto(`${base}/index.html`, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__app?.humanoid.userData.vrm && window.__app.getDoors().length > 0, { timeout: 60000 });
await new Promise((r) => setTimeout(r, 1500));
await page.evaluate(() => window.__app.switchTo('f1_living'));
await new Promise((r) => setTimeout(r, 1500));
await page.screenshot({ path: new URL(`../../temp/${name}_zone1.png`, import.meta.url).pathname });
await page.evaluate(() => {
    const { camera, controls } = window.__app;
    controls.maxPolarAngle = Math.PI * 0.52;
    camera.position.set(-2.2, 2.6, 0.2);
    controls.target.set(4.3, 1.8, 9.8);
    controls.update();
});
await new Promise((r) => setTimeout(r, 600));
await page.screenshot({ path: new URL(`../../temp/${name}_close.png`, import.meta.url).pathname });
console.log(`shot ${name}_zone1 / ${name}_close`);
await browser.close();
