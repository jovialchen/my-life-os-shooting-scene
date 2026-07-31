/** 阶段 2 目检截图：多个机位拍房子外壳（玻璃/内胆效果）
 * 用法: node tools/e2e/shot-shell.mjs <baseUrl>
 * 产出: temp/shell_front.png / shell_door.png / shell_recess.png / shell_north.png / shell_gable.png
 */
import puppeteer from 'puppeteer';

const base = process.argv[2] ?? 'http://127.0.0.1:8131';
const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
page.on('pageerror', (e) => console.log('pageerror:', e.message));

await page.goto(`${base}/index.html?frames=600`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => {
    const app = window.__app;
    return app && app.humanoid.userData.vrm && app.getDoors().length > 0;
}, { timeout: 60000 });
await new Promise((r) => setTimeout(r, 2000));

// 冻结相机：停掉 controls 阻尼回写，直接摆相机
async function shot(name, camPos, target) {
    await page.evaluate(({ camPos, target }) => {
        const app = window.__app;
        app.controls.enabled = false;
        app.camZones.mode = 'free';   // 停止机位系统的每帧回写
        app.camera.position.set(...camPos);
        app.camera.lookAt(...target);
        app.controls.target.set(...target);
    }, { camPos, target });
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({ path: `temp/${name}.png` });
    console.log(`shot ${name}`);
}

// 开门（targetT=1，updateDoors 每帧播动画）看内胆
await page.evaluate(() => {
    for (const d of window.__app.getDoors()) d.targetT = 1;
});
await new Promise((r) => setTimeout(r, 1200));

await shot('shell_front', [0, 4.5, 16], [0, 3, 4]);        // 正面全景（两翼门/窗）
await shot('shell_door', [-6.5, 1.6, 8.5], [-6.5, 1.4, 4]); // 西门近景（开门见黑）
await shot('shell_recess', [0, 2.2, 10], [0, 2.2, 1]);      // 中庭凹槽（玻璃+门廊无遮挡）
await shot('shell_north', [0, 4.5, -14], [0, 3, -5]);       // 北面全景
await shot('shell_gable', [7, 9, 13], [6.5, 8.5, 5]);       // 东山墙窗（阁楼玻璃）

await browser.close();
console.log('DONE');
