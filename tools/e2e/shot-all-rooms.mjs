/** 阶段 5 端到端验证：全动线走通（13 场景 × 25 次切换）
 * 断言：
 *   - 每个场景注册的门与传送图一致（door_target_scene / door_target_spawn）
 *   - 沿门传送图切换后角色落在对应 spawn
 *   - 每个房间截图一张（temp/rooms_<scene>.png）
 * 用法: node tools/e2e/shot-all-rooms.mjs <baseUrl>
 */
import puppeteer from 'puppeteer';

const base = process.argv[2] ?? 'http://127.0.0.1:8134';
const errors = [];
let failures = 0;
function check(name, cond, extra = '') {
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + extra + ')' : ''}`);
    if (!cond) failures++;
}

// 传送图（= 生成器/外壳脚本里的 door extras，改图时两边同步）
const GRAPH = {
    outdoor: { DOOR_entrance: ['f1_living', 'default'], DOOR_entrance_east: ['f1_kitchen', 'fromOutdoor'] },
    f1_living: {
        DOOR_exit: ['outdoor', 'houseWest'], DOOR_bath: ['f1_bath', 'default'],
        DOOR_kitchen: ['f1_kitchen', 'default'], DOOR_stairs: ['f2_study', 'default'],
    },
    f1_kitchen: { DOOR_living: ['f1_living', 'fromKitchen'], DOOR_outdoor: ['outdoor', 'houseEast'] },
    f1_bath: { DOOR_living: ['f1_living', 'fromBath'] },
    f2_study: {
        DOOR_stairs_down: ['f1_living', 'fromStudy'], DOOR_bed2: ['f2_bed2', 'default'],
        DOOR_bed1: ['f2_bed1', 'default'], DOOR_bed3: ['f2_bed3', 'default'],
        DOOR_stairs_up: ['attic_game_a', 'fromStudy'],
    },
    f2_bed1: { DOOR_study: ['f2_study', 'fromBed1'], DOOR_bath: ['f2_bath1', 'default'] },
    f2_bed2: { DOOR_study: ['f2_study', 'fromBed2'], DOOR_bath: ['f2_bath2', 'default'] },
    f2_bed3: { DOOR_study: ['f2_study', 'fromBed3'], DOOR_bath: ['f2_bath3', 'default'] },
    f2_bath1: { DOOR_bed: ['f2_bed1', 'fromBath'] },
    f2_bath2: { DOOR_bed: ['f2_bed2', 'fromBath'] },
    f2_bath3: { DOOR_bed: ['f2_bed3', 'fromBath'] },
    attic_game_a: { DOOR_stairs: ['f2_study', 'fromAtticA'], DOOR_game_b: ['attic_game_b', 'default'] },
    attic_game_b: { DOOR_game_a: ['attic_game_a', 'fromGameB'] },
};

// 全动线：沿传送图走一遍（验收总标准的路线）
const ROUTE = [
    ['f1_living', undefined],          // 室外西大门 -> 客厅
    ['f1_kitchen', undefined],         // 客厅 -> 厨房
    ['outdoor', 'houseEast'],          // 厨房 -> 东大门外
    ['f1_living', undefined],          // 室外 -> 客厅
    ['f1_bath', undefined],            // 客厅 -> 客卫
    ['f1_living', 'fromBath'],         // 客卫 -> 客厅
    ['f2_study', undefined],           // 客厅楼梯 -> 学习室
    ['f2_bed1', undefined], ['f2_bath1', undefined], ['f2_bed1', 'fromBath'], ['f2_study', 'fromBed1'],
    ['f2_bed2', undefined], ['f2_bath2', undefined], ['f2_bed2', 'fromBath'], ['f2_study', 'fromBed2'],
    ['f2_bed3', undefined], ['f2_bath3', undefined], ['f2_bed3', 'fromBath'], ['f2_study', 'fromBed3'],
    ['attic_game_a', 'fromStudy'],     // 学习室楼梯 -> 阁楼A
    ['attic_game_b', undefined],
    ['attic_game_a', 'fromGameB'],
    ['f2_study', 'fromAtticA'],
    ['f1_living', 'fromStudy'],        // 学习室楼梯 -> 客厅
    ['outdoor', 'houseWest'],          // 客厅 -> 西大门外
];

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

// 页面内助手：切场景并返回落点 + 门图
await page.evaluate(() => {
    window.__goto = async (sceneId, spawnId) => {
        const ok = await window.__app.switchTo(sceneId, spawnId);
        return {
            ok,
            pos: window.__app.humanoid.position.toArray().map((v) => +v.toFixed(2)),
            doors: Object.fromEntries(window.__app.getDoors().map((d) => [
                d.obj.name, [d.targetScene, d.targetSpawn],
            ])),
        };
    };
});

// 起始场景门图（室外）
{
    const doors = await page.evaluate(() => Object.fromEntries(
        window.__app.getDoors().map((d) => [d.obj.name, [d.targetScene, d.targetSpawn]])));
    check('室外门图', JSON.stringify(doors) === JSON.stringify(GRAPH.outdoor), JSON.stringify(doors));
}

const shotTaken = new Set();
for (const [sceneId, spawnId] of ROUTE) {
    const r = await page.evaluate((s, sp) => window.__goto(s, sp), sceneId, spawnId);
    const label = `${sceneId}${spawnId ? '/' + spawnId : ''}`;
    check(`切换 ${label}`, r.ok === true);
    // 门图一致
    const expect = GRAPH[sceneId];
    check(`${label} 门图(${Object.keys(expect).length}门)`,
        JSON.stringify(r.doors) === JSON.stringify(expect), JSON.stringify(r.doors));
    // 落点与 config 一致（由页面读 SCENES 比对）
    const spOk = await page.evaluate((s, sp, pos) => {
        const { SCENES } = window.__app.config;
        const def = SCENES.find((x) => x.id === s);
        const want = def.spawns?.[sp ?? 'default'] ?? def.spawns?.default;
        return want && Math.abs(pos[0] - want.pos[0]) < 0.01
            && Math.abs(pos[2] - want.pos[2]) < 0.01;
    }, sceneId, spawnId, r.pos);
    check(`${label} 落点`, spOk, r.pos.join(','));
    // 每个房间截图一次
    if (!shotTaken.has(sceneId)) {
        shotTaken.add(sceneId);
        await new Promise((r2) => setTimeout(r2, 400));
        await page.screenshot({ path: `temp/rooms_${sceneId}.png` });
    }
}

await browser.close();
if (errors.length > 0) {
    console.log('--- 控制台错误 ---');
    errors.forEach((e) => console.log(e));
    failures++;
}
console.log(failures === 0 ? '\nALL ROOMS E2E PASS' : `\n${failures} 项失败`);
process.exit(failures === 0 ? 0 : 1);
