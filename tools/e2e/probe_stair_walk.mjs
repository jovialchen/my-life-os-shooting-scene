/** 楼梯行走实测（挑高井道版）：
 *  1. 进客厅 → walkTo 顶部门洞（4.5, 12.05）——应在踏上平台走向门洞时触发传送到学习室
 *  2. switchTo('f1_living', 'fromStudy') ——落在顶平台（触发区外，不回环）
 *  3. walkTo 回门口 ——沿楼梯下楼，不触发传送
 * 用法: node tools/e2e/probe_stair_walk.mjs <baseUrl>
 */
import puppeteer from 'puppeteer';
const base = process.argv[2] ?? 'http://127.0.0.1:8132';
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
page.on('pageerror', (e) => console.log('pageerror:', e.message));
await page.goto(`${base}/index.html`, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__app?.humanoid.userData.vrm && window.__app.getDoors().length > 0, { timeout: 60000 });
await new Promise((r) => setTimeout(r, 1000));
await page.evaluate(() => window.__app.switchTo('f1_living'));
await page.waitForFunction(() => window.__app.getActiveScene() === 'f1_living' && window.__app.getDoors().length === 3, { timeout: 15000 });
await new Promise((r) => setTimeout(r, 800));

const sample = () => page.evaluate(() => ({
    pos: window.__app.humanoid.position.toArray().map((v) => +v.toFixed(2)),
    scene: window.__app.getActiveScene(),
}));

console.log('— 上楼（目标顶部门洞，应半路触发传送）—');
await page.evaluate(() => window.__app.walkTo(4.5, 12.05, 3.02));
let teleported = false;
for (let i = 0; i < 15 && !teleported; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const s = await sample();
    console.log(`up  pos=${s.pos.join(',')} scene=${s.scene}`);
    if (i === 4) await page.screenshot({ path: 'temp/stair_walk_up.png' });
    if (s.scene === 'f2_study') teleported = true;
}
check('上楼途中触发传送到学习室', teleported);

console.log('— 回客厅（fromStudy 落顶平台，不回环）—');
await new Promise((r) => setTimeout(r, 1000));
await page.evaluate(() => window.__app.switchTo('f1_living', 'fromStudy'));
await page.waitForFunction(() => window.__app.getActiveScene() === 'f1_living', { timeout: 15000 });
await new Promise((r) => setTimeout(r, 1500));
const sp = await sample();
check('落在顶平台 [4.5, 3.02, 11.3]', sp.scene === 'f1_living' &&
    Math.abs(sp.pos[0] - 4.5) < 0.3 && Math.abs(sp.pos[1] - 3.02) < 0.1 && Math.abs(sp.pos[2] - 11.3) < 0.3,
    sp.pos.join(','));
check('落点不回环传送', sp.scene === 'f1_living');
await page.screenshot({ path: 'temp/stair_walk_platform.png' });

console.log('— 下楼回门口 —');
await page.evaluate(() => window.__app.walkTo(0, 0.9, 0.02));
let arrived = false;
for (let i = 0; i < 15 && !arrived; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const s = await sample();
    console.log(`dn  pos=${s.pos.join(',')} scene=${s.scene}`);
    if (s.scene !== 'f1_living') break;
    if (Math.abs(s.pos[0]) < 0.4 && Math.abs(s.pos[2] - 0.9) < 0.4 && s.pos[1] < 0.2) arrived = true;
}
check('下楼走回门口（不触发传送）', arrived);

console.log('— 点击楼梯中段（stairs_to 改写目标 → 应自动上楼并传送）—');
// 把第 8 级踏步面中心（4.5, ~1.43, 8.0）投影到屏幕坐标，做一次真实鼠标点击
const clickPt = await page.evaluate(() => {
    const cam = window.__app.camera;
    cam.updateMatrixWorld();
    const V3 = Object.getPrototypeOf(cam.position).constructor;  // THREE.Vector3
    const v = new V3(4.5, 8 * (3.0 / 17) + 0.015, 5.9 + 7.5 * 0.28).project(cam);
    return {
        x: (v.x + 1) / 2 * window.innerWidth,
        y: (1 - v.y) / 2 * window.innerHeight,
        onScreen: Math.abs(v.x) < 0.98 && Math.abs(v.y) < 0.98,
    };
});
check('踏步投影在视口内', clickPt.onScreen, `screen=(${clickPt.x.toFixed(0)},${clickPt.y.toFixed(0)})`);
if (clickPt.onScreen) {
    await page.mouse.click(clickPt.x, clickPt.y);
    let clickTeleported = false;
    for (let i = 0; i < 15 && !clickTeleported; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        const s = await sample();
        console.log(`clk pos=${s.pos.join(',')} scene=${s.scene}`);
        if (s.scene === 'f2_study') clickTeleported = true;
    }
    await page.screenshot({ path: 'temp/stair_click_up.png' });
    check('点击楼梯自动上楼并传送到学习室', clickTeleported);
}

await browser.close();
console.log(failures === 0 ? '\nSTAIR WALK PASS' : `\n${failures} 项失败`);
process.exit(failures === 0 ? 0 : 1);
