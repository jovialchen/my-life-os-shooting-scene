/** 客厅两个机位截图（验收改造效果）
 * 用法: node tools/e2e/shot-living-zones.mjs <baseUrl>
 * 产出: temp/living_zone_main.png / living_zone_window.png
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
await new Promise((r) => setTimeout(r, 1800));
await page.screenshot({ path: 'temp/living_zone_main.png' });
console.log('shot living_zone_main');

await page.evaluate(() => {
    const btns = [...document.querySelectorAll('.cam-zone-btn')];
    const b = btns.find((x) => x.textContent.includes('窗'));
    if (b) b.click();
});
await new Promise((r) => setTimeout(r, 1800));
await page.screenshot({ path: 'temp/living_zone_window.png' });
console.log('shot living_zone_window');

await browser.close();
