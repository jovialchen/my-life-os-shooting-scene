import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({ headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
await page.goto('http://127.0.0.1:8132/index.html', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__app?.humanoid.userData.vrm && window.__app.getDoors().length > 0, { timeout: 60000 });
await new Promise((r) => setTimeout(r, 1500));
await page.evaluate(() => window.__app.switchTo('f1_living'));
await new Promise((r) => setTimeout(r, 2500));
await page.evaluate(() => {
    const b = [...document.querySelectorAll('.cam-zone-btn')].find((x) => x.textContent.includes('窗'));
    if (b) b.click();
});
await new Promise((r) => setTimeout(r, 2500));
const hits = await page.evaluate(async () => {
    const THREE = await import('three');
    const { camera, scene } = window.__app;
    const out = [];
    for (const [nx, ny] of [[0, 0], [-0.5, 0], [0.5, 0], [0, 0.5], [0, -0.5]]) {
        const ray = new THREE.Raycaster();
        ray.setFromCamera(new THREE.Vector2(nx, ny), camera);
        const hs = ray.intersectObjects(scene.children, true)
            .filter((h) => h.object.visible !== false)
            .slice(0, 3)
            .map((h) => `${h.object.name || h.object.parent?.name}@${h.distance.toFixed(2)}`);
        out.push(`(${nx},${ny}): ${hs.join(' | ')}`);
    }
    return out;
});
console.log(hits.join('\n'));
await browser.close();
