/** 人物发色实验：同一机位下 3 种光照组合截图对比
 *  A=当前(ambient0.9)  B=ambient1.4  C=ambient0.9+sun0.5
 * 用法: node tools/e2e/probe_char_light.mjs <baseUrl>
 */
import puppeteer from 'puppeteer';
const base = process.argv[2] ?? 'http://127.0.0.1:8132';
const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
await page.goto(`${base}/index.html`, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__app?.humanoid.userData.vrm && window.__app.getDoors().length > 0, { timeout: 60000 });
await new Promise((r) => setTimeout(r, 1000));
await page.evaluate(() => window.__app.switchTo('f1_living'));
await page.waitForFunction(() => window.__app.getActiveScene() === 'f1_living', { timeout: 15000 });
await new Promise((r) => setTimeout(r, 800));

await page.evaluate(() => {
    const app = window.__app;
    app.teleport(0, 0.02, 3.0, 0);
    app.camera.position.set(0, 1.7, 0.3);
    app.controls.target.set(0, 1.1, 3.0);
    app.controls.update();
});

const variants = [
    ['A_current', null],
    ['B_amb14', { sun: 0, ambient: 1.4, fill: 0.25, spot: 1.3 }],
    ['C_sun05', { sun: 0.5, ambient: 0.9, fill: 0.25, spot: 1.3 }],
];
for (const [name, levels] of variants) {
    if (levels) await page.evaluate((l) => window.__app.lighting.setLevels(l), levels);
    await new Promise((r) => setTimeout(r, 500));
    await page.screenshot({ path: `temp/charlight_${name}.png` });
    console.log(`shot ${name}`);
}
await browser.close();
