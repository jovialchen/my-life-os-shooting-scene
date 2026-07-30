// 无头 Edge 截图（验收用）：node tools/shot.mjs <输出文件名> [URL参数] [budget_ms]
// 例：node tools/shot.mjs cam_f1c.png "cam=f1c&az=30&pol=70&dist=12"
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const DIR = 'D:/something/my-life-os-shooting-scene/tools/preview/0729';
const [out = 'shot.png', qs = '', budget = '20000'] = process.argv.slice(2);

fs.mkdirSync(DIR, { recursive: true });
const url = `http://127.0.0.1:8123/?${qs}`;
const args = [
    '--headless=new', '--no-first-run',
    '--run-all-compositor-stages-before-draw', '--disable-new-content-rendering-timeout',
    '--window-size=1280,800', `--virtual-time-budget=${budget}`,
    `--screenshot=${path.join(DIR, out)}`, url,
];

const child = spawn(EDGE, args, { stdio: ['ignore', 'ignore', 'ignore'] });
const timer = setTimeout(() => { child.kill('SIGKILL'); }, Number(budget) + 90000);
child.on('exit', () => {
    clearTimeout(timer);
    try {
        console.log(out, fs.statSync(path.join(DIR, out)).size + 'B');
    } catch {
        console.log(out, 'FAILED');
        process.exitCode = 1;
    }
});
