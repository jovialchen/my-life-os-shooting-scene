/** 客厅窗帘 + 室内质感验收：
 * 1. 北墙全景（窗帘闭合：果绿墙 / 浅蓝顶 / 米白帘）
 * 2. 点击北墙大帘 → 收拢到两侧（窗景露出）；再点击 → 关回
 * 3. 南墙全景（1 大门 + 门两侧 2 拱窗各一副窗帘）+ 点开南墙西窗帘
 * 4. 西墙两门（客卫/厨房，进门右手边）+ 寻路可达性
 * 5. 外墙近景（灰泥质感，与内墙对比）
 *
 * 注意：相机区域系统会不时自动切机位（transition 每帧覆盖相机位姿），
 * 截图/点击前必须用 settleCam 等到相机稳定，点击用状态校验 + 重试。
 *
 * 用法: node tools/e2e/shot-living-curtain.mjs [baseUrl]
 * 产出: temp/curtain_closed.png / curtain_open.png / curtain_reclosed.png
 *       / living_south_wall.png / living_south_curtain_open.png / living_west_doors.png
 *       / exterior_wall.png
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
await page.evaluate(() => window.__app.switchTo('f1_living'));
await page.waitForFunction(() =>
    window.__app.getDoors().some((d) => d.kind === 'curtain'), { timeout: 30000 });
await new Promise((r) => setTimeout(r, 1500));

/** 摆机位并等到相机稳定（zone transition 期间每帧覆盖位姿，需等它播完） */
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

/** 点击世界点处的窗帘，直到目标组 targetT 变成 want（自动切机位可能导致拾取落空，重试） */
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
        await new Promise((r) => setTimeout(r, 1200));   // 等收拢动画
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

const NORTH_VIEW = [[2.2, 2.1, 2.2], [-2.0, 1.9, 12]];
const SOUTH_VIEW = [[0, 2.2, 9.5], [0, 1.1, 0]];

// 1. 北墙全景（窗帘闭合）
await settleCam(...NORTH_VIEW);
await page.screenshot({ path: 'temp/curtain_closed.png' });
console.log('shot curtain_closed');

// 2. 点开北墙大帘（点左帘片外缘——收拢后该处仍在帘布上）
await clickCurtainGroup(-4.25, 2.0, 11.9, 'north', 1, ...NORTH_VIEW);
await settleCam(...NORTH_VIEW);
await page.screenshot({ path: 'temp/curtain_open.png' });
console.log('shot curtain_open');

// 3. 再点关帘（验证可反复）
await clickCurtainGroup(-4.25, 2.0, 11.9, 'north', 0, ...NORTH_VIEW);
await settleCam(...NORTH_VIEW);
await page.screenshot({ path: 'temp/curtain_reclosed.png' });
console.log('shot curtain_reclosed');

// 4. 南墙全景（1 大门 + 门两侧 2 拱窗各一副窗帘）
await settleCam(...SOUTH_VIEW);
await page.screenshot({ path: 'temp/living_south_wall.png' });
console.log('shot living_south_wall');

// 4b. 点开南墙西窗窗帘（south_0 组，点左片外缘）
await clickCurtainGroup(-3.45, 1.5, 0.09, 'south_0', 1, ...SOUTH_VIEW);
await settleCam(...SOUTH_VIEW);
await page.screenshot({ path: 'temp/living_south_curtain_open.png' });
console.log('shot living_south_curtain_open');

// 5. 西墙（客卫/厨房两门，进门右手边）
await settleCam([-0.5, 1.9, 3.2], [-5, 1.1, 3.2]);
await page.screenshot({ path: 'temp/living_west_doors.png' });
console.log('shot living_west_doors');

// 6. 寻路：大门落点 → 西墙两扇新门前（验证门改西墙后仍可达）
const nav = await page.evaluate(() => {
    const V3 = window.__app.camera.position.constructor;
    const out = {};
    for (const [k, [tx, ty, tz]] of Object.entries({ fromBath: [-4.0, 0.02, 1.6], fromKitchen: [-4.0, 0.02, 4.3] })) {
        const path = window.__app.nav.findPath(new V3(0, 0.02, 0.9), new V3(tx, ty, tz));
        out[k] = path ? path.length : null;
    }
    return out;
});
console.log('nav to west doors:', JSON.stringify(nav));

// 7. 外墙近景（对比灰泥质感）
await page.evaluate(() => window.__app.switchTo('outdoor'));
await new Promise((r) => setTimeout(r, 2000));
await settleCam([-6.8, 1.8, -9.0], [-6.8, 1.6, -5.0]);
await page.screenshot({ path: 'temp/exterior_wall.png' });
console.log('shot exterior_wall');

await browser.close();
