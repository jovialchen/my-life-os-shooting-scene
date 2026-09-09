/** 窗闪隔离实验：分别隐藏 FRAMES / VIEW_window，测窗区抖动逐帧差
 * 用法: node tools/e2e/probe_flicker_iso.mjs <baseUrl>
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
await page.evaluate(() => {
    const { camera, controls } = window.__app;
    controls.maxPolarAngle = Math.PI * 0.55;
    camera.position.set(-2.0, 1.8, 5.0);
    controls.target.set(-2.05, 2.0, 12.0);
    controls.update();
});
await new Promise((r) => setTimeout(r, 500));

async function sample(label, frames = 30) {
    const diffs = await page.evaluate(async ({ frames }) => {
        const { camera, controls } = window.__app;
        const cv = document.createElement('canvas');
        cv.width = 400; cv.height = 300;
        const ctx = cv.getContext('2d', { willReadFrequently: true });
        const src = document.querySelector('canvas');
        const sx = src.width / 2 - 200, sy = src.height / 2 - 150;
        let prev = null; const out = [];
        for (let i = 0; i < frames; i++) {
            await new Promise((r) => requestAnimationFrame(r));
            camera.position.x += (i % 2 ? 1 : -1) * 0.01;
            controls.update();
            ctx.drawImage(src, sx, sy, 400, 300, 0, 0, 400, 300);
            const d = ctx.getImageData(0, 0, 400, 300).data;
            if (prev) {
                let sum = 0;
                for (let k = 0; k < d.length; k += 4)
                    sum += Math.abs(d[k]-prev[k]) + Math.abs(d[k+1]-prev[k+1]) + Math.abs(d[k+2]-prev[k+2]);
                out.push(sum / (d.length / 4));
            }
            prev = d;
        }
        return out;
    }, { frames });
    console.log(`${label}: 均差 ${(diffs.reduce((a,b)=>a+b,0)/diffs.length).toFixed(2)} 峰值 ${Math.max(...diffs).toFixed(2)}`);
}

async function setVis(name, v) {
    await page.evaluate(([name, v]) => {
        window.__app.scene.traverse((o) => { if (o.name === name) o.visible = v; });
    }, [name, v]);
    await new Promise((r) => setTimeout(r, 300));
}

await sample('基线（全开）');
await setVis('FRAMES', false);
await sample('隐藏 FRAMES');
await setVis('FRAMES', true);
await setVis('VIEW_window', false);
await sample('隐藏 VIEW_window');
await browser.close();
