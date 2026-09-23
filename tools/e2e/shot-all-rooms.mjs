/** 阶段 5 端到端验证：全动线走通（13 场景 × 30 次切换）
 * 2026-09-23 二楼重排：学习室/卧室3/卫生间1-3 取消；卧室1/2（10×12，各带
 * 上行梯→阁楼）、F2 走廊、F2 厕所接入新拓扑。
 * 2026-09-23 三楼重写：阁楼 4 房（游戏室/学习室 10×12 大房 + 走廊 + 厕所，
 * 均坡顶）取代旧 attic_game_a/b；f2 上行梯触发区改指 attic_game/attic_study
 * （阁楼没有卧室——f2 卧室1/2 楼梯上来分别进游戏室/学习室）。
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
// 注意：窗帘也注册为可交互物（target 为 null）；GLTFLoader 对重名节点追加
// _1/_2 后缀（浴室同组浴帘 3 面 → tub/tub_1/tub_2），键序 = 节点遍历序
const GRAPH = {
    outdoor: { DOOR_entrance: ['f1_living', 'default'], DOOR_entrance_east: ['f1_kitchen', 'fromOutdoor'] },
    f1_living: {
        CURTAIN_L_north: [null, null], CURTAIN_R_north: [null, null],
        CURTAIN_L_south_0: [null, null], CURTAIN_R_south_0: [null, null],
        CURTAIN_L_south_1: [null, null], CURTAIN_R_south_1: [null, null],
        DOOR_exit: ['outdoor', 'houseWest'], DOOR_corridor: ['f1_corridor', 'fromLiving'],
    },
    f1_corridor: {
        DOOR_living: ['f1_living', 'fromCorridor'], DOOR_kitchen: ['f1_kitchen', 'fromCorridor'],
        DOOR_bath: ['f1_bath', 'default'],
    },
    f1_kitchen: { DOOR_outdoor: ['outdoor', 'houseEast'], DOOR_corridor: ['f1_corridor', 'fromKitchen'] },
    f1_bath: {
        CURTAIN_L_tub: [null, null], CURTAIN_R_tub: [null, null],
        CURTAIN_L_tub_1: [null, null], CURTAIN_R_tub_1: [null, null],
        CURTAIN_L_tub_2: [null, null], CURTAIN_R_tub_2: [null, null],
        CURTAIN_L_toilet: [null, null], CURTAIN_R_toilet: [null, null],
        CURTAIN_L_toilet_1: [null, null], CURTAIN_R_toilet_1: [null, null],
        CURTAIN_L_toilet_2: [null, null], CURTAIN_R_toilet_2: [null, null],
        DOOR_corridor: ['f1_corridor', 'fromBath'],
    },
    f2_bed1: {
        DOOR_stairs_down: ['f1_living', 'fromStudy'],
        DOOR_corridor: ['f2_corridor', 'fromBed1'],
    },
    f2_bed2: {
        DOOR_stairs_down: ['f1_kitchen', 'fromStudy'],
        DOOR_corridor: ['f2_corridor', 'fromBed2'],
    },
    f2_corridor: {
        DOOR_bed1: ['f2_bed1', 'fromCorridor'], DOOR_bed2: ['f2_bed2', 'fromCorridor'],
        DOOR_bath: ['f2_bath', 'default'],
    },
    f2_bath: {
        CURTAIN_L_tub: [null, null], CURTAIN_R_tub: [null, null],
        CURTAIN_L_tub_1: [null, null], CURTAIN_R_tub_1: [null, null],
        CURTAIN_L_tub_2: [null, null], CURTAIN_R_tub_2: [null, null],
        CURTAIN_L_toilet: [null, null], CURTAIN_R_toilet: [null, null],
        CURTAIN_L_toilet_1: [null, null], CURTAIN_R_toilet_1: [null, null],
        CURTAIN_L_toilet_2: [null, null], CURTAIN_R_toilet_2: [null, null],
        DOOR_corridor: ['f2_corridor', 'fromBath'],
    },
    attic_game: {
        DOOR_stairs_down: ['f2_bed1', 'fromAtticA'],
        DOOR_corridor: ['attic_corridor', 'fromGame'],
    },
    attic_study: {
        DOOR_stairs_down: ['f2_bed2', 'fromAtticB'],
        DOOR_corridor: ['attic_corridor', 'fromStudy'],
    },
    attic_corridor: {
        DOOR_game: ['attic_game', 'fromCorridor'],
        DOOR_study: ['attic_study', 'fromCorridor'],
        DOOR_bath: ['attic_bath', 'default'],
    },
    attic_bath: { DOOR_corridor: ['attic_corridor', 'fromBath'] },
};

// 全动线：沿传送图走一遍（含四条楼梯线：客厅↔卧室1、厨房↔卧室2、
// 卧室1↔阁楼游戏室、卧室2↔阁楼学习室；楼梯 trigger 用程序直达模拟落点）
const ROUTE = [
    ['f1_living', undefined],          // 室外西大门 -> 客厅
    ['f1_corridor', 'fromLiving'],     // 客厅 -> 走廊
    ['f1_bath', undefined],            // 走廊 -> 客卫（北尽头门）
    ['f1_corridor', 'fromBath'],       // 客卫 -> 走廊
    ['f1_kitchen', 'fromCorridor'],    // 走廊 -> 厨房
    ['outdoor', 'houseEast'],          // 厨房 -> 东大门外
    ['f1_kitchen', 'fromOutdoor'],     // 东大门 -> 厨房
    ['f1_corridor', 'fromKitchen'],    // 厨房 -> 走廊
    ['f1_living', 'fromCorridor'],     // 走廊 -> 客厅
    ['f2_bed1', undefined],            // 客厅上行梯 -> 卧室1（北墙下楼门口，梯下壁龛）
    ['attic_game', undefined],         // 卧室1 上行梯 -> 阁楼游戏室（北墙下楼门口）
    ['attic_corridor', 'fromGame'],    // 游戏室 西墙门 -> 阁楼走廊
    ['attic_study', 'fromCorridor'],   // 走廊 东墙门 -> 学习室
    ['attic_corridor', 'fromStudy'],   // 学习室 东墙门 -> 阁楼走廊
    ['attic_bath', undefined],         // 走廊 北尽头门 -> 阁楼厕所
    ['attic_corridor', 'fromBath'],    // 厕所 南门 -> 阁楼走廊
    ['attic_game', 'fromCorridor'],    // 走廊 西墙门 -> 游戏室
    ['f2_bed1', 'fromAtticA'],         // 游戏室 北墙下楼门 -> 卧室1 上行梯平台
    ['f2_corridor', 'fromBed1'],       // 卧室1 -> F2 走廊
    ['f2_bed2', 'fromCorridor'],       // F2 走廊 -> 卧室2
    ['attic_study', undefined],        // 卧室2 上行梯 -> 阁楼学习室
    ['f2_bed2', 'fromAtticB'],         // 学习室 北墙下楼门 -> 卧室2 上行梯平台
    ['f1_kitchen', 'fromStudy'],       // 卧室2 北墙下楼门 -> 厨房平台
    ['f2_bed2', undefined],            // 厨房上行梯 -> 卧室2
    ['f2_corridor', 'fromBed2'],       // 卧室2 -> F2 走廊
    ['f2_bath', undefined],            // F2 走廊北尽头 -> F2 厕所
    ['f2_corridor', 'fromBath'],       // F2 厕所 -> 走廊
    ['f2_bed1', 'fromCorridor'],       // 走廊 -> 卧室1
    ['f1_living', 'fromStudy'],        // 卧室1 北墙下楼门 -> 客厅平台
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
