import puppeteer from 'puppeteer';
const scenes = process.argv.slice(2);
const browser = await puppeteer.launch({ headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
for (const s of scenes) {
    await page.goto(`http://127.0.0.1:8130/index.html?scene=${s}&frames=400`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction((id) => window.__app && window.__app.getActiveScene?.() === id
        && window.__app.humanoid.userData.vrm, { timeout: 60000 }, s);
    await new Promise(r => setTimeout(r, 2500));
    await page.screenshot({ path: `temp/chk_${s}.png` });
    console.log(`shot temp/chk_${s}.png`);
}
await browser.close();
