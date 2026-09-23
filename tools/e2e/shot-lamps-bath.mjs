/** 浴室帘子 + 一楼吸顶灯 + 开灯按钮 验收：
 * 1. 客卫：浴帘/马桶帘闭合全景 → 点击两组帘 → 收拢（再点关回验证可反复）
 * 2. 客厅：夜晚 开灯 vs 关灯（差别应显著，灯罩发光）；中午 开灯 vs 关灯（差别应很小）
 *
 * 用法: node tools/e2e/shot-lamps-bath.mjs [baseUrl]
 * 产出: temp/bath_curtain_closed.png / bath_curtain_open.png / bath_toilet_curtain_open.png
 *       / lamp_night_on.png / lamp_night_off.png / lamp_noon_on.png / lamp_noon_off.png
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
await page.waitForFunction(() => {
    const app = window.__app;
    return app && app.humanoid.userData.vrm && app.getDoors().length > 0;
}, { timeout: 60000 });
await new Promise((r) => setTimeout(r, 1500));

async function settleCam(pos, tgt) {
    for (let i = 0; i < 10; i++) {
        await page.evaluate(([p, t]) => {
            const { camera, controls } = window.__app;
            camera.position.set(...p);
            controls.target.set(...t);
            controls.update();
        }, [pos, tgt]);
        await new Promise((r) => setTimeout(r, 400));
        const moved = await page.evaluate(([p, t]) => {
            const c = window.__app.camera.position, g = window.__app.controls.target;
            return Math.hypot(c.x - p[0], c.y - p[1], c.z - p[2])
                 + Math.hypot(g.x - t[0], g.y - t[1], g.z - t[2]);
        }, [pos, tgt]);
        if (moved < 0.08) return;
    }
    console.log('  !! settleCam 未稳定');
}

async function clickCurtainGroup(wx, wy, wz, group, want, camPos, camTgt) {
    for (let i = 0; i < 4; i++) {
        if (camPos) await settleCam(camPos, camTgt);
        const pt = await page.evaluate(([x, y, z]) => {
            const { camera } = window.__app;
            const V3 = camera.position.constructor;
            const p = new V3(x, y, z).project(camera);
            return { x: (p.x * 0.5 + 0.5) * innerWidth, y: (-p.y * 0.5 + 0.5) * innerHeight };
        }, [wx, wy, wz]);
        await page.mouse.click(pt.x, pt.y);
        await new Promise((r) => setTimeout(r, 1200));
        const t = await page.evaluate((g) =>
            window.__app.getDoors().find((d) => d.curtainGroup === g)?.targetT, group);
        if (t === want) {
            console.log(`  窗帘组 ${group} → targetT=${want}（第 ${i + 1} 次点击）`);
            return true;
        }
    }
    console.log(`  !! 窗帘组 ${group} 未能切到 ${want}`);
    return false;
}

async function setTime(v) {
    await page.evaluate((val) => window.__app.timeOfDay.update(val), v);
    await new Promise((r) => setTimeout(r, 300));
}

async function setLights(on) {
    const cur = await page.evaluate(() =>
        document.getElementById('light-toggle').classList.contains('active'));
    if (cur !== on) await page.click('#light-toggle');
    await new Promise((r) => setTimeout(r, 300));
}

// ── 客卫：浴帘 + 马桶帘 ──
await page.evaluate(() => window.__app.switchTo('f1_bath'));
await page.waitForFunction(() =>
    window.__app.getDoors().some((d) => d.curtainGroup === 'tub')
    && window.__app.getDoors().some((d) => d.curtainGroup === 'toilet'), { timeout: 30000 });
await new Promise((r) => setTimeout(r, 1500));
await setTime(2);   // 中午，看得最清楚

// 浴缸视角（东墙）：帘子闭合
const TUB_VIEW = [[-3.2, 2.4, 3.0], [3.0, 1.0, 5.0]];
await settleCam(...TUB_VIEW);
await page.screenshot({ path: 'temp/bath_curtain_closed.png' });
console.log('shot bath_curtain_closed');

// 点开浴帘（点南端帘片，收拢后仍在南端）
await clickCurtainGroup(2.35, 1.2, 3.6, 'tub', 1, ...TUB_VIEW);
await settleCam(...TUB_VIEW);
await page.screenshot({ path: 'temp/bath_curtain_open.png' });
console.log('shot bath_curtain_open');

// 马桶帘视角（东北角）
const TOILET_VIEW = [[-0.5, 2.2, 6.0], [2.2, 0.9, 9.4]];
await clickCurtainGroup(1.7, 1.2, 8.45, 'toilet', 1, ...TOILET_VIEW);
await settleCam(...TOILET_VIEW);
await page.screenshot({ path: 'temp/bath_toilet_curtain_open.png' });
console.log('shot bath_toilet_curtain_open');

// ── 客厅：吸顶灯 开/关 × 夜晚/中午 ──
await page.evaluate(() => window.__app.switchTo('f1_living'));
await page.waitForFunction(() =>
    window.__app.getDoors().some((d) => d.curtainGroup === 'north'), { timeout: 30000 });
await new Promise((r) => setTimeout(r, 1500));

// 机位：看房间全景+天花板灯（南向北看，略仰头）
const LAMP_VIEW = [[0, 1.8, 1.2], [0, 3.2, 7.0]];

await setTime(5);   // 夜晚
await setLights(true);
await settleCam(...LAMP_VIEW);
await page.screenshot({ path: 'temp/lamp_night_on.png' });
console.log('shot lamp_night_on');

await setLights(false);
await page.screenshot({ path: 'temp/lamp_night_off.png' });
console.log('shot lamp_night_off');

await setTime(2);   // 中午
await setLights(true);
await page.screenshot({ path: 'temp/lamp_noon_on.png' });
console.log('shot lamp_noon_on');

await setLights(false);
await page.screenshot({ path: 'temp/lamp_noon_off.png' });
console.log('shot lamp_noon_off');

// 报告灯强度（确认时间联动数值）
const levels = [];
for (const [t, on] of [[2, true], [5, true], [5, false]]) {
    await setTime(t);
    await setLights(on);
    levels.push(await page.evaluate(() => window.__app.timeOfDay.getLampLevel()));
}
console.log('lampLevel 中午开 / 夜晚开 / 夜晚关 =', levels.map((v) => v.toFixed(2)).join(' / '));

await browser.close();
