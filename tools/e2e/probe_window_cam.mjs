import puppeteer from 'puppeteer';
const base = 'http://127.0.0.1:8132';
const browser = await puppeteer.launch({ headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
await page.goto(`${base}/index.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => window.__app?.humanoid.userData.vrm && window.__app.getDoors().length > 0, { timeout: 60000 });
await new Promise((r) => setTimeout(r, 1500));
await page.evaluate(() => window.__app.switchTo('f1_living'));
await new Promise((r) => setTimeout(r, 1800));
await page.evaluate(() => {
    const b = [...document.querySelectorAll('.cam-zone-btn')].find((x) => x.textContent.includes('窗'));
    if (b) b.click();
});
await new Promise((r) => setTimeout(r, 1800));
const info = await page.evaluate(() => {
    const cam = window.__app.camera;
    return { pos: cam.position.toArray().map((v) => +v.toFixed(2)) };
});
console.log('cam pos:', info.pos);
await browser.close();
