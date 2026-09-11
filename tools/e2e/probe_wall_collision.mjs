/** 相机防穿墙碰撞验收：客厅机位 6 个方位角把相机推到墙外，验证半径被收缩、画面不穿墙
 * 用法: node tools/e2e/probe_wall_collision.mjs <baseUrl>
 * 产出: temp/cam_probe_az*.png + 各方位角收缩后半径日志
 */
import puppeteer from 'puppeteer';

const base = process.argv[2] ?? 'http://127.0.0.1:8000';

const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
page.on('pageerror', (e) => console.log('pageerror:', e.message));
await page.goto(`${base}/index.html?scene=f1_living`, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(
    () => window.__app?.humanoid.userData.vrm && window.__app.getActiveScene() === 'f1_living',
    { timeout: 60000 },
);
await new Promise((r) => setTimeout(r, 1500));

const setOrbit = (azDeg, polDeg, dist) => page.evaluate((az, pol, d) => {
    const { camera, controls } = window.__app;
    const a = az * Math.PI / 180, p = pol * Math.PI / 180;
    const t = controls.target;
    camera.position.set(
        t.x + d * Math.sin(p) * Math.sin(a),
        t.y + d * Math.cos(p),
        t.z + d * Math.sin(p) * Math.cos(a),
    );
    controls.update();
}, azDeg, polDeg, dist);

const radius = () => page.evaluate(
    () => window.__app.camera.position.distanceTo(window.__app.controls.target));

for (const az of [0, 60, 120, 180, 240, 300]) {
    await setOrbit(az, 70, 13);
    await new Promise((r) => setTimeout(r, 1200));   // 等碰撞收缩收敛
    const d = await radius();
    console.log(`az=${az} finalRadius=${d.toFixed(2)}`);
    await page.screenshot({ path: `temp/cam_probe_az${az}.png` });
}
await browser.close();
