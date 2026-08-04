/** 一次性：多角度拍房子外壳，排查"玻璃穿出屋顶"和"窗框缺结构"
 * 用法: node tools/e2e/shot-house-angles.mjs <baseUrl>
 */
import puppeteer from 'puppeteer';

const base = process.argv[2] ?? 'http://127.0.0.1:8134';
const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
page.on('pageerror', (e) => console.log('pageerror:', e.message));

await page.goto(`${base}/index.html?frames=600`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => {
    const app = window.__app;
    return app && app.humanoid.userData.vrm && app.getDoors().length > 0;
}, { timeout: 60000 });
await new Promise((r) => setTimeout(r, 2000));

async function shot(name, camPos, target) {
    await page.evaluate(({ camPos, target }) => {
        const app = window.__app;
        app.controls.enabled = false;
        app.camZones.mode = 'free';
        app.camera.position.set(...camPos);
        app.camera.lookAt(...target);
        app.controls.target.set(...target);
    }, { camPos, target });
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({ path: `temp/${name}.png` });
    console.log(`shot ${name}`);
}

await shot('house_overview_se', [14, 10, 14], [0, 4, 0]);    // 东南高位全景
await shot('house_overview_nw', [-14, 10, -14], [0, 4, 0]);  // 西北高位全景
await shot('house_gable_west', [-7, 9, 13], [-6.5, 8.5, 5]); // 西山墙
await shot('house_north_mid', [1.5, 2.5, -10], [1.5, 2.2, -5]); // 北面中间窗近景
await shot('house_east_side', [16, 5, 0], [9, 4, 0]);        // 东侧
await shot('house_west_side', [-16, 5, 0], [-9, 4, 0]);      // 西侧

await browser.close();
console.log('DONE');
