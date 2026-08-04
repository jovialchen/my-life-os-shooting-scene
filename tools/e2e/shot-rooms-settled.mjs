/** 一次性：逐房间切换后等相机过渡完成再截图（验收 7×7×3 全景视角）
 * 用法: node tools/e2e/shot-rooms-settled.mjs <baseUrl>
 * 产出: temp/settled_<scene>.png
 */
import puppeteer from 'puppeteer';

const base = process.argv[2] ?? 'http://127.0.0.1:8134';
const SCENES = ['f1_living', 'f1_kitchen', 'f1_bath', 'f2_study',
    'f2_bed1', 'f2_bath1', 'attic_game_a', 'attic_game_b'];

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

for (const s of SCENES) {
    await page.evaluate((id) => window.__app.switchTo(id), s);
    await new Promise((r) => setTimeout(r, 1600));
    await page.screenshot({ path: `temp/settled_${s}.png` });
    console.log(`shot ${s}`);
}
await browser.close();
