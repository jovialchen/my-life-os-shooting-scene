/** 一楼改版验收截图：厨房（窗机位 + 餐桌近景）、走廊（北端回看南端窗）
 * 用法: node tools/e2e/shot-f1-suite.mjs <baseUrl>
 * 产出: temp/f1_kitchen_win.png / f1_kitchen_dining.png / f1_corridor_back.png
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
await page.goto(`${base}/index.html`, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__app?.humanoid.userData.vrm && window.__app.getDoors().length > 0, { timeout: 60000 });
await new Promise((r) => setTimeout(r, 1500));

const go = async (scene, spawn) => {
    await page.evaluate((s, sp) => window.__app.switchTo(s, sp), scene, spawn);
    await page.waitForFunction((s) => window.__app.getActiveScene() === s, { timeout: 15000 }, scene);
    await new Promise((r) => setTimeout(r, 1200));
};
const cam = async (px, py, pz, tx, ty, tz) => {
    await page.evaluate((p, t) => {
        const { camera, controls } = window.__app;
        controls.maxPolarAngle = Math.PI * 0.55;
        camera.position.set(...p);
        controls.target.set(...t);
        controls.update();
    }, [px, py, pz], [tx, ty, tz]);
    await new Promise((r) => setTimeout(r, 600));
};

// 厨房：东北角窗机位（看南墙门窗 + 餐桌区 + 楼梯）
await go('f1_kitchen');
await cam(3.2, 2.5, 10.5, -2.0, 0.7, 2.0);
await page.screenshot({ path: 'temp/f1_kitchen_win.png' });
console.log('shot f1_kitchen_win');

// 厨房：餐桌近景（人物站桌边）
await page.evaluate(() => window.__app.teleport(-0.3, 0.02, 5.6, Math.PI));
await cam(-2.6, 1.7, 6.6, 0.2, 0.5, 3.2);
await page.screenshot({ path: 'temp/f1_kitchen_dining.png' });
console.log('shot f1_kitchen_dining');

// 走廊：北端（客卫门口）回看南端窗（吊灯纵深 + 地毯）
await go('f1_corridor', 'fromBath');
await cam(0, 1.9, 11.2, 0, 1.2, 1.0);
await page.screenshot({ path: 'temp/f1_corridor_back.png' });
console.log('shot f1_corridor_back');

await browser.close();
