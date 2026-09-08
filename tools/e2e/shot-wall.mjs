/** 墙面灰泥纹理 shader 验收截图：开 vs 关、室外庭院 + 室内 + 傍晚 */
import puppeteer from 'puppeteer';
const base = process.argv[2] ?? 'http://127.0.0.1:8130';
const shots = [
    ['wall_ext',      'scene=outdoor&time=2&az=0&pol=80&dist=7&lookat=0,2.5,5'],
    ['wall_ext_off',  'scene=outdoor&time=2&az=0&pol=80&dist=7&lookat=0,2.5,5&wallgrain=0'],
    ['wall_ext_dusk', 'scene=outdoor&time=4&az=0&pol=80&dist=7&lookat=0,2.5,5'],
    ['wall_in',       'scene=f1_living&time=2'],
    ['wall_in_off',   'scene=f1_living&time=2&wallgrain=0'],
];
const browser = await puppeteer.launch({ headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
page.on('pageerror', e => console.log('PAGE EXC:', e.message));
for (const [name, q] of shots) {
    await page.goto(`${base}/index.html?${q}&frames=400`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__app?.humanoid.userData.vrm, { timeout: 60000 });
    await new Promise(r => setTimeout(r, 2500));
    await page.screenshot({ path: `temp/${name}.png` });
    console.log(`shot temp/${name}.png`);
}
await browser.close();
