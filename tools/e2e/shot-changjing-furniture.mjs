/** changjing 家具验收截图：厨房 / 客卫 / 二楼卫生间（2026-09-23 起 F2 厕所
 *  与客卫同为 8×10、共用 furniture_bath_f1.glb）
 * 用法: node tools/e2e/shot-changjing-furniture.mjs <baseUrl>
 * 产出: temp/cgf_app_{kitchen,bath_f1,bath_f2}.png
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

await page.goto(`${base}/index.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => {
    const app = window.__app;
    return app && app.humanoid.userData.vrm && app.getDoors().length > 0;
}, { timeout: 60000 });
await new Promise((r) => setTimeout(r, 1500));

const SHOTS = [
    {   // 厨房：人物站中岛旁，机位从西南看东北角 L 橱柜 + 中岛
        scene: 'f1_kitchen', out: 'temp/cgf_app_kitchen.png',
        pos: [1.2, 0.02, 4.6], rotY: Math.PI * 0.75,
        cam: [-2.6, 2.2, 3.2], target: [2.5, 0.9, 10.0],
    },
    {   // 客卫：人物站浴缸旁，机位从西南看浴缸 + 马桶 + 洗手盆
        scene: 'f1_bath', out: 'temp/cgf_app_bath_f1.png',
        pos: [1.2, 0.02, 4.5], rotY: Math.PI * 0.5,
        cam: [-2.8, 2.2, 1.6], target: [1.5, 0.7, 7.5],
    },
    {   // 二楼卫生间：房间 8×10 与客卫同（复用同一份卫浴家具），同机位
        scene: 'f2_bath', out: 'temp/cgf_app_bath_f2.png',
        pos: [1.2, 0.02, 4.5], rotY: Math.PI * 0.5,
        cam: [-2.8, 2.2, 1.6], target: [1.5, 0.7, 7.5],
    },
];

for (const s of SHOTS) {
    await page.evaluate((sc) => window.__app.switchTo(sc), s.scene);
    await page.waitForFunction((sc) => window.__app.getActiveScene() === sc, { timeout: 15000 }, s.scene);
    await new Promise((r) => setTimeout(r, 1200));
    await page.evaluate((cfg) => {
        const app = window.__app;
        app.teleport(cfg.pos[0], cfg.pos[1], cfg.pos[2], cfg.rotY);
        app.controls.maxPolarAngle = Math.PI * 0.55;
        app.camera.position.set(...cfg.cam);
        app.controls.target.set(...cfg.target);
        app.controls.update();
    }, s);
    await new Promise((r) => setTimeout(r, 900));
    await page.screenshot({ path: s.out });
    console.log('shot', s.out);
}

await browser.close();
