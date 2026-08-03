/** 阶段 4 端到端验证：室内光照反映室外时间
 * 断言：
 *   - 切到客厅：sun 归零（无直射）、窗光按场景配置重摆、ambient 偏暗
 *   - 时段联动：窗景片/窗玻璃变色（白天亮蓝→夜晚深蓝）、夜晚顶灯自动开
 *   - 切回室外：光照配置还原（sun 恢复、顶灯归零）
 * 用法: node tools/e2e/shot-lighting.mjs <baseUrl>
 * 产出: temp/light_living_{noon,dusk,night}.png / light_outdoor_night.png
 */
import puppeteer from 'puppeteer';

const base = process.argv[2] ?? 'http://127.0.0.1:8133';
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

// 页面内助手：挂到 window 上供后续 evaluate 直接用
await page.evaluate(() => {
    window.__matColor = (name) => {
        let hex = null;
        window.__app.scene.traverse((o) => {
            if (hex || !o.isMesh || !o.material) return;
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            const m = mats.find((mm) => mm.name === name);
            if (m) hex = m.color.getHexString();
        });
        return hex;
    };
});

// ── 1. 室外中午：默认光照（spot 归零、顶灯关、玻璃亮蓝）──
const outdoorNoon = await page.evaluate(() => {
    const app = window.__app;
    app.timeOfDay.update(2);
    return {
        sun: app.lighting.sun.intensity,
        spot: app.lighting.windowLight.intensity,
        lamp: app.lighting.lamp.intensity,
        glass: window.__matColor('MAT_window_glass'),
    };
});
check('室外中午 sun 满强度', Math.abs(outdoorNoon.sun - 2.0) < 0.01, String(outdoorNoon.sun));
check('室外窗光归零', outdoorNoon.spot === 0, String(outdoorNoon.spot));
check('室外顶灯关', outdoorNoon.lamp === 0, String(outdoorNoon.lamp));
check('室外玻璃中午亮蓝', outdoorNoon.glass === 'bfe3ff', String(outdoorNoon.glass));

// ── 2. 切到客厅：无直射阳光、窗光重摆、ambient 偏暗 ──
await page.evaluate(() => window.__app.switchTo('f1_living'));
await page.waitForFunction(() => window.__app.getDoors().length === 4, { timeout: 10000 });
await new Promise((r) => setTimeout(r, 800));
const roomNoon = await page.evaluate(() => {
    const app = window.__app;
    return {
        sun: app.lighting.sun.intensity,
        ambient: app.lighting.ambient.intensity,
        spot: app.lighting.windowLight.intensity,
        spotPos: app.lighting.windowLight.position.toArray().map((v) => +v.toFixed(2)),
        lamp: app.lighting.lamp.intensity,
        lampPos: app.lighting.lamp.position.toArray().map((v) => +v.toFixed(2)),
        view: window.__matColor('MAT_window_view'),
    };
});
check('客厅无直射阳光', roomNoon.sun === 0, String(roomNoon.sun));
check('客厅 ambient 偏暗(0.4×0.75)', Math.abs(roomNoon.ambient - 0.3) < 0.01, String(roomNoon.ambient));
check('客厅窗光中午主光源(1.5×1.3)', Math.abs(roomNoon.spot - 1.95) < 0.01, String(roomNoon.spot));
check('客厅窗光位姿按场景配置',
    roomNoon.spotPos[0] === 0 && roomNoon.spotPos[1] === 2.2 && roomNoon.spotPos[2] === 7.5,
    roomNoon.spotPos.join(','));
check('客厅顶灯中午关', roomNoon.lamp === 0, String(roomNoon.lamp));
check('客厅顶灯位姿按场景配置',
    roomNoon.lampPos[0] === 0 && roomNoon.lampPos[1] === 2.4 && roomNoon.lampPos[2] === 2.5,
    roomNoon.lampPos.join(','));
check('窗景片中午亮蓝', roomNoon.view === 'bfe3ff', String(roomNoon.view));
await page.screenshot({ path: 'temp/light_living_noon.png' });

// ── 3. 客厅傍晚：窗景片变橙、顶灯渐开 ──
const roomDusk = await page.evaluate(() => {
    const app = window.__app;
    app.timeOfDay.update(4);
    return {
        spot: app.lighting.windowLight.intensity,
        lamp: app.lighting.lamp.intensity,
        view: window.__matColor('MAT_window_view'),
    };
});
check('客厅傍晚窗光减弱(0.6×1.3)', Math.abs(roomDusk.spot - 0.78) < 0.01, String(roomDusk.spot));
check('客厅傍晚顶灯渐开(1.0×1.6)', Math.abs(roomDusk.lamp - 1.6) < 0.01, String(roomDusk.lamp));
check('窗景片傍晚橙', roomDusk.view === 'ff8a50', String(roomDusk.view));
await new Promise((r) => setTimeout(r, 300));
await page.screenshot({ path: 'temp/light_living_dusk.png' });

// ── 4. 客厅夜晚：窗光灭、顶灯全开、窗景片深蓝 ──
const roomNight = await page.evaluate(() => {
    const app = window.__app;
    app.timeOfDay.update(5);
    return {
        spot: app.lighting.windowLight.intensity,
        lamp: app.lighting.lamp.intensity,
        view: window.__matColor('MAT_window_view'),
    };
});
check('客厅夜晚窗光灭', roomNight.spot === 0, String(roomNight.spot));
check('客厅夜晚顶灯全开(1.5×1.6)', Math.abs(roomNight.lamp - 2.4) < 0.01, String(roomNight.lamp));
check('窗景片夜晚深蓝', roomNight.view === '10204a', String(roomNight.view));
await new Promise((r) => setTimeout(r, 300));
await page.screenshot({ path: 'temp/light_living_night.png' });

// ── 5. 夜晚切回室外：顶灯归零、玻璃深蓝、无窗光 ──
await page.evaluate(() => window.__app.switchTo('outdoor', 'houseWest'));
await page.waitForFunction(() => window.__app.getDoors().length === 2, { timeout: 10000 });
await new Promise((r) => setTimeout(r, 800));
const outdoorNight = await page.evaluate(() => {
    const app = window.__app;
    return {
        lamp: app.lighting.lamp.intensity,
        spot: app.lighting.windowLight.intensity,
        glass: window.__matColor('MAT_window_glass'),
    };
});
check('室外夜晚顶灯归零', outdoorNight.lamp === 0, String(outdoorNight.lamp));
check('室外夜晚无窗光', outdoorNight.spot === 0, String(outdoorNight.spot));
check('室外玻璃夜晚深蓝', outdoorNight.glass === '10204a', String(outdoorNight.glass));
await page.screenshot({ path: 'temp/light_outdoor_night.png' });

// ── 6. 室外回中午：sun 恢复 ──
const outdoorNoon2 = await page.evaluate(() => {
    const app = window.__app;
    app.timeOfDay.update(2);
    return { sun: app.lighting.sun.intensity, lamp: app.lighting.lamp.intensity };
});
check('切回室外 sun 恢复', Math.abs(outdoorNoon2.sun - 2.0) < 0.01, String(outdoorNoon2.sun));
check('切回室外顶灯仍关', outdoorNoon2.lamp === 0, String(outdoorNoon2.lamp));

await browser.close();
if (errors.length > 0) {
    console.log('--- 控制台错误 ---');
    errors.forEach((e) => console.log(e));
    failures++;
}
console.log(failures === 0 ? '\nLIGHTING E2E PASS' : `\n${failures} 项失败`);
process.exit(failures === 0 ? 0 : 1);
