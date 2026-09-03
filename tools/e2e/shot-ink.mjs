/** 水墨风格多机位截图：时段 × 场景 */
import puppeteer from 'puppeteer';
const base = process.argv[2] ?? 'http://127.0.0.1:8130';
const shots = [
    ['ink_dusk',     'scene=outdoor&time=4&az=35&pol=65&dist=22&lookat=0,2,2'],
    ['ink_night',    'scene=outdoor&time=5&az=35&pol=65&dist=22&lookat=0,2,2'],
    ['ink_court',    'scene=outdoor&time=1.5&az=180&pol=70&dist=10&lookat=0,1.2,3'],
    ['ink_living',   'scene=f1_living&time=2'],
    ['ink_overview', 'scene=outdoor&time=2&az=135&pol=55&dist=38&lookat=0,1,3'],
];
const browser = await puppeteer.launch({ headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
for (const [name, q] of shots) {
    await page.goto(`${base}/index.html?${q}&frames=400`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__app?.humanoid.userData.vrm, { timeout: 60000 });
    await new Promise(r => setTimeout(r, 2500));
    await page.screenshot({ path: `temp/${name}.png` });
    console.log(`shot temp/${name}.png`);
}
await browser.close();
