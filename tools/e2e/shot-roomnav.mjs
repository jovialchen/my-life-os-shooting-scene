/** 房间直达导航面板 E2E（plan-0805 阶段 4）
 *
 * 断言：
 * 1. 面板渲染：4 个分组、13 个场景按钮
 * 2. 逐一点击直达：当前场景 = 目标、落点 = config spawn default、按钮高亮/禁用正确
 * 3. 语言切换后按钮文案跟随
 *
 * 用法（先起 python3 -m http.server 8130）:
 *   PUPPETEER_CACHE_DIR=$PWD/tools/e2e/.cache node tools/e2e/shot-roomnav.mjs "http://127.0.0.1:8130"
 */
import puppeteer from 'puppeteer';

const base = process.argv[2] ?? 'http://127.0.0.1:8130';
const url = `${base}/index.html`;
const errors = [];
const logs = [];

const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
page.on('console', (msg) => {
    logs.push(`[${msg.type()}] ${msg.text()}`);
    if (msg.type() === 'error' && !msg.text().startsWith('Failed to load resource')) errors.push(msg.text());
});
page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => {
    const app = window.__app;
    return app && app.humanoid.userData.vrm && app.getDoors().length > 0;
}, { timeout: 60000 });

let pass = 0, fail = 0;
function check(name, cond, extra = '') {
    if (cond) { pass++; console.log(`  PASS ${name}`); }
    else { fail++; console.log(`  FAIL ${name} ${extra}`); }
}

// ── 1. 面板渲染 ──
console.log('== 面板渲染 ==');
await page.click('#room-nav-toggle');
const layout = await page.evaluate(() => ({
    groups: [...document.querySelectorAll('.room-nav-header')].map((h) => h.textContent),
    buttons: [...document.querySelectorAll('.room-nav-btn')].map((b) => ({
        scene: b.dataset.scene, text: b.textContent, active: b.classList.contains('active'), disabled: b.disabled,
    })),
    sceneCount: window.__app.config.SCENES.length,
}));
check('4 个分组', layout.groups.length === 4, JSON.stringify(layout.groups));
check('按钮数 = SCENES 数', layout.buttons.length === layout.sceneCount, `${layout.buttons.length} vs ${layout.sceneCount}`);
const outdoorBtn = layout.buttons.find((b) => b.scene === 'outdoor');
check('初始场景 outdoor 高亮且禁用', outdoorBtn?.active && outdoorBtn?.disabled, JSON.stringify(outdoorBtn));

// ── 2. 逐一点击直达 ──
console.log('== 逐一点击直达 ==');
const targets = layout.buttons.map((b) => b.scene).filter((id) => id !== 'outdoor');
for (const sceneId of targets) {
    await page.click(`.room-nav-btn[data-scene="${sceneId}"]`);
    // 等切换完成且面板状态刷新（切换中 busy 会先把所有按钮禁用，高亮随后才打上）
    await page.waitForFunction(
        (id) => window.__app.getActiveScene() === id
            && document.querySelector(`.room-nav-btn[data-scene="${id}"]`)?.classList.contains('active'),
        { timeout: 30000 }, sceneId,
    );
    const state = await page.evaluate((id) => {
        const app = window.__app;
        const def = app.config.SCENES.find((s) => s.id === id);
        const sp = def.spawns?.default;
        const p = app.humanoid.position;
        const btn = document.querySelector(`.room-nav-btn[data-scene="${id}"]`);
        return {
            active: app.getActiveScene(),
            pos: [p.x, p.y, p.z],
            spawn: sp?.pos ?? null,
            btnActive: btn?.classList.contains('active') ?? false,
            btnDisabled: btn?.disabled ?? false,
        };
    }, sceneId);
    const posOk = state.spawn
        && Math.abs(state.pos[0] - state.spawn[0]) < 0.01
        && Math.abs(state.pos[2] - state.spawn[2]) < 0.01;
    check(`${sceneId} 直达+落点+高亮`,
        state.active === sceneId && posOk && state.btnActive && state.btnDisabled,
        JSON.stringify(state));
}

// ── 3. 语言切换文案 ──
console.log('== 语言切换 ==');
await page.evaluate(() => {
    localStorage.setItem('scene-lang', 'en');
    window.dispatchEvent(new CustomEvent('scene-lang-change'));
});
const enTexts = await page.evaluate(() => ({
    title: document.getElementById('room-nav-title').textContent,
    first: document.querySelector('.room-nav-btn').textContent,
    headers: [...document.querySelectorAll('.room-nav-header')].map((h) => h.textContent),
}));
check('英文文案', enTexts.title === 'Rooms' && enTexts.first === 'Outdoor' && enTexts.headers.includes('Attic'),
    JSON.stringify(enTexts));
await page.evaluate(() => {
    localStorage.setItem('scene-lang', 'zh');
    window.dispatchEvent(new CustomEvent('scene-lang-change'));
});

await browser.close();

console.log(`\n${pass} PASS / ${fail} FAIL`);
if (errors.length > 0) {
    console.log('--- 控制台错误 ---');
    errors.forEach((e) => console.log(e));
    process.exit(1);
}
if (fail > 0) process.exit(1);
console.log('ROOMNAV PASS');
