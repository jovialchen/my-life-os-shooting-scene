/** 一次性：打印切到厨房后的相机实际位姿（排查视角被挡） */
import puppeteer from 'puppeteer';

const base = process.argv[2] ?? 'http://127.0.0.1:8134';
const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
await page.goto(`${base}/index.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => {
    const app = window.__app;
    return app && app.humanoid.userData.vrm && app.getDoors().length > 0;
}, { timeout: 60000 });
await new Promise((r) => setTimeout(r, 1500));
await page.evaluate(() => window.__app.switchTo('f1_kitchen'));
await new Promise((r) => setTimeout(r, 2000));
const info = await page.evaluate(() => {
    const app = window.__app;
    return {
        camPos: app.camera.position.toArray().map((v) => +v.toFixed(2)),
        target: app.controls.target.toArray().map((v) => +v.toFixed(2)),
        fov: app.camera.fov,
    };
});
console.log(JSON.stringify(info));
await browser.close();
