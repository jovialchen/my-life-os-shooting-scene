/** 屋顶瓦片 shader 验收截图：勾线/假光影 开 vs 关、多时段 */
import puppeteer from 'puppeteer';
const base = process.argv[2] ?? 'http://127.0.0.1:8130';
const shots = [
    ['roof_noon',  'scene=outdoor&time=2&az=35&pol=60&dist=18&lookat=0,4,2'],
    ['roof_off',   'scene=outdoor&time=2&az=35&pol=60&dist=18&lookat=0,4,2&roofshade=0&roofline=0'],
    ['roof_dusk',  'scene=outdoor&time=4&az=35&pol=60&dist=18&lookat=0,4,2'],
    ['roof_night', 'scene=outdoor&time=5&az=35&pol=60&dist=18&lookat=0,4,2'],
    ['roof_far',   'scene=outdoor&time=2&az=135&pol=55&dist=38&lookat=0,1,3'],
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
