/** 客厅北墙特写（验收窗帘/楼梯/挂画区）+ 西墙沙发特写
 * 用法: node tools/e2e/shot-living-north.mjs <baseUrl>
 * 产出: temp/living_north.png / living_sofa.png
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
await page.waitForFunction(() => {
    const app = window.__app;
    return app && app.humanoid.userData.vrm && app.getDoors().length > 0;
}, { timeout: 60000 });
await new Promise((r) => setTimeout(r, 1500));
await page.evaluate(() => window.__app.switchTo('f1_living'));
await new Promise((r) => setTimeout(r, 1500));

async function shotCam(name, pos, tgt) {
    await page.evaluate(([p, t]) => {
        const { camera, controls } = window.__app;
        camera.position.set(...p);
        controls.target.set(...t);
        controls.update();
    }, [pos, tgt]);
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({ path: `temp/${name}.png` });
    console.log(`shot ${name}`);
}

await shotCam('living_north', [1.6, 1.7, 1.6], [-1.3, 1.4, 7]);
await shotCam('living_sofa', [1.2, 1.6, 2.2], [-3.4, 0.8, 4.6]);
await shotCam('living_east', [-1.2, 1.7, 2.6], [3.5, 1.0, 2.8]);
await browser.close();
