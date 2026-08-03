/** 阶段 3 端到端验证：室外 → 客厅 → 按 E → 回室外 → 按 E → 进客厅
 * 用法: node tools/e2e/shot-room.mjs <baseUrl>
 * 产出: temp/room_living.png / room_prompt.png / room_back_outdoor.png
 */
import puppeteer from 'puppeteer';

const base = process.argv[2] ?? 'http://127.0.0.1:8132';
const errors = [];
let failures = 0;
function check(name, cond, extra = '') {
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + extra + ')' : ''}`);
    if (!cond) failures++;
}

const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(m.text());
});

await page.goto(`${base}/index.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => {
    const app = window.__app;
    return app && app.humanoid.userData.vrm && app.getDoors().length > 0;
}, { timeout: 60000 });
await new Promise((r) => setTimeout(r, 1500));

// ── 1. 室外：走近西大门，应出现"按 E 进入客厅" ──
await page.evaluate(() => window.__app.humanoid.position.set(-6.5, 0, 5.0));
await new Promise((r) => setTimeout(r, 400));
const prompt1 = await page.evaluate(() => {
    const el = document.getElementById('door-prompt');
    return { show: el.classList.contains('show'), text: el.textContent };
});
check('室外西门气泡提示', prompt1.show && prompt1.text.includes('客厅'), prompt1.text);

// ── 2. 按 E → 进入客厅 ──
await page.keyboard.press('KeyE');
await page.waitForFunction(() => window.__app.getDoors().length === 4, { timeout: 10000 });
await new Promise((r) => setTimeout(r, 800));
const roomState = await page.evaluate(() => ({
    doors: window.__app.getDoors().map((d) => d.obj.name),
    pos: window.__app.humanoid.position.toArray().map((v) => +v.toFixed(2)),
    camButtons: document.querySelectorAll('.cam-zone-btn').length,
}));
check('进入客厅（DOOR_exit 注册）', roomState.doors.includes('DOOR_exit'), roomState.doors.join());
check('落点在门内', Math.abs(roomState.pos[0]) < 0.2 && Math.abs(roomState.pos[2] - 0.9) < 0.3,
    roomState.pos.join(','));
check('客厅机位按钮（2 机位 + 跟随）', roomState.camButtons === 3, String(roomState.camButtons));
await page.screenshot({ path: 'temp/room_living.png' });

// ── 3. 房内气泡：站在出口门旁 ──
const prompt2 = await page.evaluate(() => {
    const el = document.getElementById('door-prompt');
    return { show: el.classList.contains('show'), text: el.textContent };
});
check('房内出口门气泡提示', prompt2.show && prompt2.text.includes('室外'), prompt2.text);
await page.screenshot({ path: 'temp/room_prompt.png' });

// ── 4. 按 E → 回室外（houseWest 落点）──
await page.keyboard.press('KeyE');
await page.waitForFunction(() => window.__app.getDoors().length === 2, { timeout: 10000 });
await new Promise((r) => setTimeout(r, 800));
const outState = await page.evaluate(() => ({
    doors: window.__app.getDoors().map((d) => d.obj.name),
    pos: window.__app.humanoid.position.toArray().map((v) => +v.toFixed(2)),
    camButtons: document.querySelectorAll('.cam-zone-btn').length,
}));
check('回到室外（2 门重注册）', outState.doors.includes('DOOR_entrance'), outState.doors.join());
check('落点 houseWest', Math.abs(outState.pos[0] + 6.5) < 0.3 && Math.abs(outState.pos[2] - 5.6) < 0.3,
    outState.pos.join(','));
check('室外机位恢复 4 个（3 机位 + 跟随，旧室内机位已删）', outState.camButtons === 4, String(outState.camButtons));
await page.screenshot({ path: 'temp/room_back_outdoor.png' });

// ── 5. 点击西门（真实点击路径：pickDoorAt → toggleDoor → onDoorTrigger）──
await page.evaluate(() => {
    const app = window.__app;
    app.controls.enabled = false;
    app.camera.position.set(-6.5, 1.8, 8.0);
    app.controls.target.set(-6.5, 1.2, 4.0);
    app.camera.lookAt(-6.5, 1.2, 4.0);
    app.controls.update();
});
await new Promise((r) => setTimeout(r, 400));
// 门板中心（世界坐标实测 [-7.09..-5.95, 0.02..2.30, 3.92..3.98]）投影到屏幕
const clickPt = await page.evaluate(() => {
    const cam = window.__app.camera;
    cam.updateMatrixWorld();
    const v = { x: -6.52, y: 1.15, z: 3.95 };
    const m = cam.projectionMatrix.elements, iv = cam.matrixWorldInverse.elements;
    const vx = iv[0] * v.x + iv[4] * v.y + iv[8] * v.z + iv[12];
    const vy = iv[1] * v.x + iv[5] * v.y + iv[9] * v.z + iv[13];
    const vz = iv[2] * v.x + iv[6] * v.y + iv[10] * v.z + iv[14];
    const cx = m[0] * vx + m[8] * vz;
    const cy = m[5] * vy + m[9] * vz;
    const cw = -vz;
    return {
        x: (cx / cw * 0.5 + 0.5) * innerWidth,
        y: (-cy / cw * 0.5 + 0.5) * innerHeight,
    };
});
// 先确认射线能命中门，再点击
const hit = await page.evaluate((p) => {
    const d = window.__app.pickDoorAt(p.x, p.y);
    return d ? d.obj.name : null;
}, clickPt);
check('pickDoorAt 命中西门', hit === 'DOOR_entrance', String(hit));
await page.mouse.move(clickPt.x, clickPt.y);
await page.mouse.down();
await new Promise((r) => setTimeout(r, 60));
await page.mouse.up();
await page.waitForFunction(() => window.__app.getDoors().length === 4, { timeout: 10000 });
const clickState = await page.evaluate(() => window.__app.getDoors().map((d) => d.obj.name));
check('点击传送门 → 切到客厅', clickState.includes('DOOR_exit'), clickState.join());

await browser.close();
if (errors.length > 0) {
    console.log('--- 控制台错误 ---');
    errors.forEach((e) => console.log(e));
    failures++;
}
console.log(failures === 0 ? '\nROOM E2E PASS' : `\n${failures} 项失败`);
process.exit(failures === 0 ? 0 : 1);
