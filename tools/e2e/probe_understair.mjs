/** 悬空梯梯下净空探测：低段踏步下不可走、高段踏步下+平台壁龛可走
 * 用法: node tools/e2e/probe_understair.mjs <baseUrl>
 */
import puppeteer from 'puppeteer';
const base = process.argv[2] ?? 'http://127.0.0.1:8132';
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('pageerror:', e.message));
await page.goto(`${base}/index.html`, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__app?.humanoid.userData.vrm && window.__app.getDoors().length > 0, { timeout: 60000 });
await page.evaluate(() => window.__app.switchTo('f1_living'));
await page.waitForFunction(() => window.__app.getActiveScene() === 'f1_living', { timeout: 15000 });
await new Promise((r) => setTimeout(r, 800));
const r = await page.evaluate(() => ({
    under_low: window.__app.nav.isWalkableWorld(4.5, 7.0, 0.02),   // 第4步下方（净高~0.6）应 false
    under_high: window.__app.nav.isWalkableWorld(4.5, 9.5, 0.02),  // 第13步下方（净高~2.2）应 true
    nook: window.__app.nav.isWalkableWorld(4.5, 11.3, 0.02),       // 平台壁龛应 true
    strip: window.__app.nav.isWalkableWorld(4.5, 5.5, 0.02),       // 楼梯南条应 true
}));
let bad = 0;
const expect = { under_low: false, under_high: true, nook: true, strip: true };
for (const k of Object.keys(expect)) {
    const ok = r[k] === expect[k];
    if (!ok) bad++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${k} = ${r[k]}（期望 ${expect[k]}）`);
}
await browser.close();
process.exit(bad ? 1 : 0);
