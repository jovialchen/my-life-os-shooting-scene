/** 阶段 6 内存检查：反复切换场景 20 次，JS 堆增长应收敛
 * （场景容器常驻+缓存，不 dispose；如持续增长说明有泄漏）
 * 用法: node tools/e2e/mem-switch.mjs <baseUrl>
 */
import puppeteer from 'puppeteer';

const base = process.argv[2] ?? 'http://127.0.0.1:8135';
const CYCLE = ['f1_living', 'f1_kitchen', 'f2_study', 'f2_bed1', 'attic_game_a', 'outdoor'];
const ROUNDS = 4;   // 4 轮 × 6 场景 = 24 次切换

const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--use-gl=swiftshader', '--enable-unsafe-swiftshader',
        '--enable-precise-memory-info'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(`${base}/index.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => {
    const app = window.__app;
    return app && app.humanoid.userData.vrm && app.getDoors().length > 0;
}, { timeout: 60000 });
await new Promise((r) => setTimeout(r, 1500));

const heapMB = () => page.evaluate(() => performance.memory.usedJSHeapSize / 1048576);

// 先全量预热一轮（所有场景加载进缓存），再测增长
for (const s of CYCLE) await page.evaluate((id) => window.__app.switchTo(id), s);
const before = await heapMB();

for (let r = 0; r < ROUNDS; r++) {
    for (const s of CYCLE) await page.evaluate((id) => window.__app.switchTo(id), s);
    console.log(`第 ${r + 1}/${ROUNDS} 轮完成`);
}
// 强制 GC 后测一次（expose gc 需要 --js-flags，没有就等 2s 让浏览器自己收）
await new Promise((r) => setTimeout(r, 2000));
const after = await heapMB();

const delta = after - before;
console.log(`堆: 预热后 ${before.toFixed(1)} MB → ${ROUNDS} 轮后 ${after.toFixed(1)} MB（Δ ${delta.toFixed(1)} MB）`);

await browser.close();
// 缓存场景反复切换不应持续增长；留 30MB 余量（VRM 表情/UI 等少量分配）
const ok = delta < 30 && errors.length === 0;
if (errors.length > 0) errors.forEach((e) => console.log(`pageerror: ${e}`));
console.log(ok ? 'MEM PASS' : 'MEM FAIL');
process.exit(ok ? 0 : 1);
