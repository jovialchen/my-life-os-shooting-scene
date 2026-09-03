/** 验证：中午蓝天 + 人物去灰特写 */
import puppeteer from 'puppeteer';
const base = process.argv[2] ?? 'http://127.0.0.1:8130';
const shots = [
    ['ink_noon_sky',  'scene=outdoor&time=2&az=35&pol=65&dist=22&lookat=0,2,2', null],
    // 传送到西门外草坪再拍（默认出生点在房子黑内胆腔体里，不是室外）
    ['ink_char_noon', 'scene=outdoor&time=2&az=250&pol=72&dist=4&lookat=-6.5,1.1,5.6', [-6.5, 0, 5.6]],
    ['ink_char_dusk', 'scene=outdoor&time=4&az=250&pol=72&dist=4&lookat=-6.5,1.1,5.6', [-6.5, 0, 5.6]],
];
const browser = await puppeteer.launch({ headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
for (const [name, q, tp] of shots) {
    await page.goto(`${base}/index.html?${q}&frames=400`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__app?.humanoid.userData.vrm, { timeout: 60000 });
    if (tp) await page.evaluate(([x, y, z]) => window.__app.teleport(x, y, z), tp);
    await new Promise(r => setTimeout(r, 2500));
    await page.screenshot({ path: `temp/${name}.png` });
    console.log(`shot temp/${name}.png`);
}
await browser.close();
