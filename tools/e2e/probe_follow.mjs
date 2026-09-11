/** 跟随镜头平移验收：角色走动时相机应随 target 同步平移（轨道偏移不变），
 * 而不是原地转头。走前走后对比 camera-target 偏移向量，并截图。
 * 用法: node tools/e2e/probe_follow.mjs <baseUrl>
 * 产出: temp/follow_before.png / follow_mid.png / follow_after.png
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

const snapshot = () => page.evaluate(() => {
    const { camera, controls, humanoid } = window.__app;
    return {
        cam: camera.position.toArray(),
        target: controls.target.toArray(),
        hum: humanoid.position.toArray(),
        mode: window.__app.camZones.mode,
    };
});

// 切到跟随模式（点「跟随」按钮）
await page.evaluate(() => document.querySelector('.cam-follow-btn').click());
await new Promise((r) => setTimeout(r, 300));

const before = await snapshot();
await page.screenshot({ path: 'temp/follow_before.png' });

// 角色从南侧走向东北侧（穿过大半个房间；避开西北的沙发/蒲团）
await page.evaluate(() => window.__app.walkTo(2.5, 9.5));
await new Promise((r) => setTimeout(r, 2500));
await page.screenshot({ path: 'temp/follow_mid.png' });

// 等走完（位置稳定）+ 跟随收敛
try {
    await page.waitForFunction(() => {
        const h = window.__app.humanoid.position;
        window.__lastH = window.__lastH ?? h.toArray();
        const still = Math.hypot(h.x - window.__lastH[0], h.z - window.__lastH[2]) < 0.02;
        window.__lastH = h.toArray();
        return still;
    }, { timeout: 25000, polling: 500 });
} catch {
    console.log('warn: 角色 25s 内未停稳');
}
await new Promise((r) => setTimeout(r, 2000));
const after = await snapshot();
await page.screenshot({ path: 'temp/follow_after.png' });

const offset = (s) => s.cam.map((v, i) => v - s.target[i]);
const ob = offset(before), oa = offset(after);
const drift = Math.hypot(ob[0] - oa[0], ob[1] - oa[1], ob[2] - oa[2]);
console.log('偏移(前):', ob.map((v) => v.toFixed(2)).join(', '));
console.log('偏移(后):', oa.map((v) => v.toFixed(2)).join(', '));
console.log('偏移漂移:', drift.toFixed(3), 'm（越小越好；角色走了',
    Math.hypot(after.hum[0] - before.hum[0], after.hum[2] - before.hum[2]).toFixed(1), 'm）');
console.log('target(后):', after.target.map((v) => v.toFixed(2)).join(', '),
    ' 角色(后):', after.hum.map((v) => v.toFixed(2)).join(', '));
await browser.close();
