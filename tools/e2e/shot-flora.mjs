/** 树/石头纹理 shader 验收截图：树冠、树干、石板路、岛底岩层，开 vs 关 + 秋季 */
import puppeteer from 'puppeteer';
const base = process.argv[2] ?? 'http://127.0.0.1:8130';
const OFF = 'leafshade=0&leafgrain=0&barkgrain=0&rockshade=0&rockgrain=0';
const shots = [
    ['flora_tree',      'scene=outdoor&time=2&az=220&pol=75&dist=8&lookat=12,3,10'],
    ['flora_tree_off',  `scene=outdoor&time=2&az=220&pol=75&dist=8&lookat=12,3,10&${OFF}`],
    ['flora_over',      'scene=outdoor&time=2&az=135&pol=55&dist=38&lookat=0,1,3'],
    ['flora_autumn',    'scene=outdoor&time=4&season=2&az=220&pol=75&dist=8&lookat=12,3,10'],
    ['rock_path',       'scene=outdoor&time=2&az=20&pol=65&dist=5&lookat=0,0.3,10'],
    ['rock_path_off',   `scene=outdoor&time=2&az=20&pol=65&dist=5&lookat=0,0.3,10&${OFF}`],
    ['rock_bottom',     'scene=outdoor&time=2&az=140&pol=95&dist=30&lookat=0,-3,5'],
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
