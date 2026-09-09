/** 窗户闪烁复现探针：对着北墙窗组，静止 & 微动相机各采 N 帧，
 *  统计窗区逐帧平均像素差（闪 = 静止时仍有大幅逐帧变化）
 * 用法: node tools/e2e/probe_window_flicker.mjs <baseUrl>
 */
import puppeteer from 'puppeteer';
const base = process.argv[2] ?? 'http://127.0.0.1:8132';
const browser = await puppeteer.launch({ headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
page.on('pageerror', (e) => console.log('pageerror:', e.message));
await page.goto(`${base}/index.html`, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__app?.humanoid.userData.vrm && window.__app.getDoors().length > 0, { timeout: 60000 });
await page.evaluate(() => window.__app.switchTo('f1_living'));
await new Promise((r) => setTimeout(r, 1500));

// 相机对着北墙窗组（窗中心 x≈-2.05, y≈2.0, z=12）
await page.evaluate(() => {
    const { camera, controls } = window.__app;
    controls.maxPolarAngle = Math.PI * 0.55;
    camera.position.set(-2.0, 1.8, 5.0);
    controls.target.set(-2.05, 2.0, 12.0);
    controls.update();
});
await new Promise((r) => setTimeout(r, 500));

// 把窗（世界坐标）投影到屏幕，圈出采样区域
const region = await page.evaluate(() => {
    const { camera } = window.__app;
    const V3 = Object.getPrototypeOf(camera.position).constructor;
    const c = new V3(-2.05, 2.0, 11.9).project(camera);
    return { x: (c.x + 1) / 2 * innerWidth, y: (1 - c.y) / 2 * innerHeight };
});
console.log('窗中心屏幕坐标', region.x.toFixed(0), region.y.toFixed(0));

async function sample(label, frames, jiggle) {
    const diffs = await page.evaluate(async ({ region, frames, jiggle }) => {
        const { camera, controls } = window.__app;
        const cv = document.createElement('canvas');
        cv.width = 160; cv.height = 160;
        const ctx = cv.getContext('2d', { willReadFrequently: true });
        const src = document.querySelector('canvas');
        const sx = Math.max(0, region.x - 80), sy = Math.max(0, region.y - 80);
        const out = [];
        let prev = null;
        for (let i = 0; i < frames; i++) {
            await new Promise((r) => requestAnimationFrame(r));
            if (jiggle) {
                camera.position.x += (i % 2 ? 1 : -1) * 0.01;
                controls.update();
            }
            ctx.drawImage(src, sx, sy, 160, 160, 0, 0, 160, 160);
            const d = ctx.getImageData(0, 0, 160, 160).data;
            if (prev) {
                let sum = 0, max = 0;
                for (let k = 0; k < d.length; k += 4) {
                    const df = Math.abs(d[k] - prev[k]) + Math.abs(d[k+1] - prev[k+1]) + Math.abs(d[k+2] - prev[k+2]);
                    sum += df; if (df > max) max = df;
                }
                out.push({ mean: +(sum / (d.length / 4)).toFixed(2), max });
            }
            prev = d;
        }
        return out;
    }, { region, frames, jiggle });
    const means = diffs.map((d) => d.mean);
    const maxs = diffs.map((d) => d.max);
    console.log(`${label}: 逐帧均差 mean=${(means.reduce((a,b)=>a+b,0)/means.length).toFixed(2)} `
        + `峰值=${Math.max(...means)} maxPix=${Math.max(...maxs)}`);
}

await sample('静止 30 帧', 30, false);
await sample('微动 30 帧', 30, true);
await page.screenshot({ path: 'temp/window_flicker_view.png' });
await browser.close();
