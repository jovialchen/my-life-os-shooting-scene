/** 运行时导航诊断：页面内 findPath / isWalkableWorld / groundHeightAt 对照 */
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
await page.waitForFunction(() => window.__app.getActiveScene() === 'f1_living' && window.__app.getDoors().length === 3, { timeout: 15000 });
await new Promise((r) => setTimeout(r, 800));

const diag = await page.evaluate(async () => {
    const THREE = await import('three');
    const { nav } = window.__app;
    const path = nav.findPath(new THREE.Vector3(0, 0.02, 0.9), new THREE.Vector3(3.55, 3.03, 9.3));
    return {
        pathLen: path ? path.length : null,
        pathTail: path ? path.slice(-5).map((p) => [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)]) : null,
        walkStep9: nav.isWalkableWorld(3.5, 7.0, 1.6),
        walkLanding: nav.isWalkableWorld(3.5, 9.7, 3.03),
        walkFloor: nav.isWalkableWorld(-1.0, 5.0, 0.02),
        groundStairMid: nav.groundHeightAt(3.5, 7.0, 1.6),
        groundLanding: nav.groundHeightAt(3.5, 9.5, 3.03),
    };
});
console.log(JSON.stringify(diag, null, 1));
await browser.close();
