/**
 * 冒烟测试：无头浏览器加载 app，验证场景管理器重构后零回归
 * 用法: node tools/smoke-app.mjs [url]
 *   PUPPETEER_CACHE 环境变量指向 tools/e2e/.cache（含 chrome）
 */
import puppeteer from 'puppeteer';

const url = process.argv[2] ?? 'http://127.0.0.1:8123/index.html?frames=60';
const errors = [];
const logs = [];

const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
page.on('console', msg => {
    const text = msg.text();
    logs.push(`[${msg.type()}] ${text}`);
    if (msg.type() === 'error' && !text.startsWith('Failed to load resource')) errors.push(text);
});
page.on('response', res => {
    if (res.status() === 404 && res.url().includes('favicon')) return;   // 忽略 favicon
    if (res.status() >= 400) errors.push(`HTTP ${res.status()} ${res.url()}`);
});
page.on('pageerror', err => errors.push(`pageerror: ${err.message}`));

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

// 等模型加载 + 渲染若干帧
try {
    await page.waitForFunction(() => {
        const app = window.__app;
        return app && app.humanoid.userData.vrm && app.getDoors().length > 0;
    }, { timeout: 60000 });
} catch (e) {
    console.log('--- 等待就绪超时，已收集日志 ---');
    logs.forEach(l => console.log(l));
    if (errors.length > 0) {
        console.log('--- pageerror ---');
        errors.forEach(e => console.log(e));
    }
    await page.screenshot({ path: 'temp/smoke_timeout.png' }).catch(() => {});
    await browser.close();
    process.exit(1);
}
await new Promise(r => setTimeout(r, 3000));

const report = await page.evaluate(() => {
    const app = window.__app;
    return {
        doors: app.getDoors().length,
        hasVrm: !!app.humanoid.userData.vrm,
        camMode: app.camZones.mode,
        currentZone: app.camZones.currentZone?.id ?? null,
        camButtons: document.querySelectorAll('.cam-zone-btn').length,
        camGroups: document.querySelectorAll('.cam-group').length,
        fadeOverlay: !!document.getElementById('fade-overlay'),
        switchToType: typeof app.switchTo,
    };
});

// 截图目检
await page.screenshot({ path: 'temp/smoke_outdoor.png' });

// switchTo 健壮性：切到不存在的场景应拒绝且不报错
const switchResult = await page.evaluate(async () => {
    const ok = await window.__app.switchTo('nonexistent');
    const same = await window.__app.switchTo('outdoor');
    return { nonexistent: ok, sameScene: same };
});

await browser.close();

console.log('--- 页面状态 ---');
console.log(JSON.stringify({ ...report, switchResult }, null, 2));
console.log('--- 关键日志 ---');
for (const l of logs.filter(l => /HouseShell|CameraZones|Doors|SceneManager/.test(l))) console.log(l);
if (errors.length > 0) {
    console.log('--- 控制台错误 ---');
    errors.forEach(e => console.log(e));
    process.exit(1);
}
console.log('SMOKE PASS');
