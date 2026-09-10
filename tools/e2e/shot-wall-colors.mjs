/** 客厅墙色候选对比：运行时改 MAT_wall_interior 颜色，逐色截图
 * 用法: node tools/e2e/shot-wall-colors.mjs [baseUrl]
 * 产出: temp/wall_try_XXXXXX.png × N
 */
import puppeteer from 'puppeteer';

const base = process.argv[2] ?? 'http://127.0.0.1:8132';
// 候选：当前豆绿（对照）+ 非绿色系候选
const CANDIDATES = [
    ['B5C9A4', 'bean_current'],   // 当前淡豆绿（对照）
    ['EDE4D3', 'cream'],          // 米白奶油（其余 11 间房统一墙色 PALETTE.wall）
    ['E3D2B8', 'milktea'],        // 奶茶杏（暖米棕，木地板同族）
    ['EBC9B0', 'peach'],          // 蜜桃粉（呼应圆墩灰珊瑚/人物粉）
    ['F0DCAE', 'goose'],          // 鹅黄（暖黄，配木色）
    ['B4C7CE', 'bluegray'],       // 雾霾蓝（和浅蓝天花板同色系偏冷）
];

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
await page.waitForFunction(() =>
    window.__app.getDoors().some((d) => d.kind === 'curtain'), { timeout: 30000 });
await new Promise((r) => setTimeout(r, 1500));

// 摆机位（南墙视角，墙面占比大）
await page.evaluate(() => {
    const { camera, controls } = window.__app;
    camera.position.set(0, 2.2, 9.5);
    controls.target.set(0, 1.1, 0);
    controls.update();
});
await new Promise((r) => setTimeout(r, 2500));   // 等机位 transition 播完

for (const [hex, label] of CANDIDATES) {
    await page.evaluate((h) => {
        const { camera, controls, scene } = window.__app;
        camera.position.set(0, 2.2, 9.5);
        controls.target.set(0, 1.1, 0);
        controls.update();
        scene.traverse((o) => {
            if (!o.isMesh) return;
            for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
                if (m.name === 'MAT_wall_interior') m.color.set(`#${h}`);
            }
        });
    }, hex);
    await new Promise((r) => setTimeout(r, 200));
    await page.screenshot({ path: `temp/wall_try_${hex}_${label}.png` });
    console.log(`shot wall_try_${hex}_${label}`);
}
await browser.close();
