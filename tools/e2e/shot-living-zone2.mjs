/** 客厅机位2（living_window，东北角高位）截图验收
 * 用法: node tools/e2e/shot-living-zone2.mjs <baseUrl>   （cwd 任意，截图写到项目 temp/）
 */
import puppeteer from 'puppeteer';
const base = process.argv[2] ?? 'http://127.0.0.1:8132';
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
page.on('pageerror', (e) => console.log('pageerror:', e.message));
await page.goto(`${base}/index.html`, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__app?.humanoid.userData.vrm && window.__app.getDoors().length > 0, { timeout: 60000 });
await new Promise((r) => setTimeout(r, 1500));
await page.evaluate(() => window.__app.switchTo('f1_living'));
await new Promise((r) => setTimeout(r, 1200));
await page.evaluate(() => document.querySelectorAll('.cam-zone-btn')[1].click());
await new Promise((r) => setTimeout(r, 1200));
await page.screenshot({ path: new URL('../../temp/living_zone2.png', import.meta.url).pathname });
console.log('shot living_zone2');
await browser.close();
