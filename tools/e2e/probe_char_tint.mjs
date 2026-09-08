/** 人物发色排查：室内客厅 vs 室外，同机位截图对比
 * 用法: node tools/e2e/probe_char_tint.mjs <baseUrl>
 */
import puppeteer from 'puppeteer';
const base = process.argv[2] ?? 'http://127.0.0.1:8132';
const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
await page.goto(`${base}/index.html`, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__app?.humanoid.userData.vrm && window.__app.getDoors().length > 0, { timeout: 60000 });
await new Promise((r) => setTimeout(r, 1500));

async function shotChar(name, pos, camPos) {
    await page.evaluate(([p, c]) => {
        const app = window.__app;
        app.teleport(...p);
        app.camera.position.set(...c);
        app.controls.target.set(p[0], p[1] + 1.0, p[2]);
        app.controls.update();
    }, [pos, camPos]);
    await new Promise((r) => setTimeout(r, 800));
    await page.screenshot({ path: `temp/${name}.png` });
    console.log(`shot ${name}`);
}

// 室外对照
await shotChar('char_outdoor', [-4, 0, 0, 0], [-4, 1.6, 3.5]);
// 室内
await page.evaluate(() => window.__app.switchTo('f1_living'));
await page.waitForFunction(() => window.__app.getActiveScene() === 'f1_living', { timeout: 15000 });
await new Promise((r) => setTimeout(r, 800));
await shotChar('char_living', [0, 0.02, 3.0, 0], [0, 1.6, 0.5]);
await browser.close();
