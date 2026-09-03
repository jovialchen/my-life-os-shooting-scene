/** 六时段天空验证：同一机位扫 time=0..5 */
import puppeteer from 'puppeteer';
const base = 'http://127.0.0.1:8130';
const browser = await puppeteer.launch({ headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
for (let t = 0; t <= 5; t++) {
    await page.goto(`${base}/index.html?scene=outdoor&time=${t}&az=35&pol=65&dist=22&lookat=0,2,2&frames=400`,
        { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__app?.humanoid.userData.vrm, { timeout: 60000 });
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: `temp/ink_time${t}.png` });
    console.log(`shot temp/ink_time${t}.png`);
}
await browser.close();
