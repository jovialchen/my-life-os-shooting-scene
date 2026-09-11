/** 进门视角验收：相机放在南门内、面朝房间（+z），所见即"进门面窗"的左右手
 * 客厅：左=楼梯(+x 墙)，右=走廊门(-x 墙)；厨房：左=走廊门(+x 墙)，右=楼梯(-x 墙)
 * 用法: node tools/e2e/shot-entry-view.mjs <baseUrl>
 * 产出: temp/entry_living.png / entry_kitchen.png
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

for (const scene of ['f1_living', 'f1_kitchen']) {
    await page.evaluate((s) => window.__app.switchTo(s), scene);
    await page.waitForFunction((s) => window.__app.getActiveScene() === s, { timeout: 15000 }, scene);
    await new Promise((r) => setTimeout(r, 1200));
    await page.evaluate(() => {
        const { camera, controls } = window.__app;
        controls.maxPolarAngle = Math.PI * 0.6;
        // 门内、高过头顶、正对北墙窗（+z 直视）——所见左/右 = 进门人的左/右手
        camera.position.set(0, 2.3, 1.8);
        controls.target.set(0, 1.1, 10);
        controls.update();
    });
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({ path: `temp/entry_${scene}.png` });
    console.log(`shot entry_${scene}`);
    // 转向走廊门一侧（客厅在 -x 墙/右手边，厨房在 +x 墙/左手边）
    const side = scene === 'f1_living' ? -1 : 1;
    await page.evaluate((s) => {
        const { camera, controls } = window.__app;
        camera.position.set(0, 2.0, 1.6);
        controls.target.set(s * 5, 1.1, 6);
        controls.update();
    }, side);
    await new Promise((r) => setTimeout(r, 500));
    await page.screenshot({ path: `temp/entry_${scene}_door.png` });
    console.log(`shot entry_${scene}_door`);
}
await browser.close();
