/** 客厅楼梯导航分段探测：从门口到顶部门洞逐段 findPath，定位断点
 * 用法: node tools/e2e/probe_stair_nav.mjs <baseUrl>
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
await page.goto(`${base}/index.html`, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__app?.humanoid.userData.vrm && window.__app.getDoors().length > 0, { timeout: 60000 });
await page.evaluate(() => window.__app.switchTo('f1_living'));
await page.waitForFunction(() => window.__app.getActiveScene() === 'f1_living', { timeout: 15000 });
await new Promise((r) => setTimeout(r, 800));

// 沿楼梯中线分段（南侧条 → 第1步 → 第5步 → 第10步 → 第17步 → 平台 → 门洞）
const LEGS = [
    ['门口→楼梯南条', [0, 0.02, 0.9], [4.5, 0.02, 5.6]],
    ['南条→第1步', [4.5, 0.02, 5.6], [4.5, 0.19, 6.05]],
    ['第1步→第5步', [4.5, 0.19, 6.05], [4.5, 0.9, 7.15]],
    ['第5步→第10步', [4.5, 0.9, 7.15], [4.5, 1.78, 8.55]],
    ['第10步→第17步', [4.5, 1.78, 8.55], [4.5, 3.01, 10.5]],
    ['第17步→平台', [4.5, 3.01, 10.5], [4.5, 3.02, 11.3]],
    ['平台→门洞', [4.5, 3.02, 11.3], [4.5, 3.02, 12.1]],
    ['全程 门口→门洞', [0, 0.02, 0.9], [4.5, 3.02, 12.1]],
];
for (const [name, s, e] of LEGS) {
    const r = await page.evaluate(([s, e]) => {
        const path = window.__app.nav.findPath(
            { x: s[0], y: s[1], z: s[2], }, { x: e[0], y: e[1], z: e[2] });
        // findPath 需要 THREE.Vector3——用 walkTo 同款入口不行就直接构造
        return path ? path.length : null;
    }, [s, e]).catch(() => 'ERR');
    console.log(`${r ? 'PASS' : 'FAIL'}  ${name}  path=${r}`);
}
await browser.close();
