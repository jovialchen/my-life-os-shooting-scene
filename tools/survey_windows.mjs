/** 阶段 1.1：外壳窗户测绘（plan-0805）
 *
 * 复用 add_shell_core.mjs 的 WINDOW_01 格栅聚类逻辑（连通块 → 墙面平面
 * → 面内簇 → 列/段），但不生成几何，只输出窗户清单：
 * 每扇逻辑窗 = 一个簇（含若干玻璃分段），报告所在墙面、面内 u 范围、
 * 高度范围（窗台 sill ~ 窗顶 top）、分段数。
 *
 * 产物：temp/window_survey.json + 控制台表格。
 * 坐标系：glTF/three 世界坐标（y 上，x 东西，z 南北，北为 -z）。
 *
 * 用法: node tools/survey_windows.mjs [glb路径]
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const path = process.argv[2] || 'models/house.glb';

function parseGlb(path) {
    const buf = readFileSync(path);
    const jsonLen = buf.readUInt32LE(12);
    const gltf = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf-8'));
    let off = 20 + jsonLen;
    const binLen = buf.readUInt32LE(off);
    const bin = Buffer.from(buf.subarray(off + 8, off + 8 + binLen));
    return { gltf, bin };
}

function readAccessor(gltf, bin, idx) {
    const acc = gltf.accessors[idx];
    const bv = gltf.bufferViews[acc.bufferView];
    const start = (bv.byteOffset || 0) + (acc.byteOffset || 0);
    const compSize = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }[acc.componentType];
    const nComp = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[acc.type];
    const out = new Array(acc.count * nComp);
    for (let i = 0; i < acc.count; i++) {
        const base = start + i * compSize * nComp;
        for (let c = 0; c < nComp; c++) {
            const p = base + c * compSize;
            if (acc.componentType === 5126) out[i * nComp + c] = bin.readFloatLE(p);
            else if (acc.componentType === 5123) out[i * nComp + c] = bin.readUInt16LE(p);
            else if (acc.componentType === 5125) out[i * nComp + c] = bin.readUInt32LE(p);
            else if (acc.componentType === 5121) out[i * nComp + c] = bin.readUInt8(p);
        }
    }
    return out;
}

const { gltf, bin } = parseGlb(path);

// ── WINDOW_01 格栅连通块（与 add_shell_core.mjs 相同）──
const winNode = gltf.nodes.find((n) => n.name === 'WINDOW_01');
if (!winNode) throw new Error('找不到 WINDOW_01 节点');
const winPrim = gltf.meshes[winNode.mesh].primitives[0];
const pos = readAccessor(gltf, bin, winPrim.attributes.POSITION);
const idx = winPrim.indices !== undefined
    ? readAccessor(gltf, bin, winPrim.indices)
    : pos.map((_, i) => i);

const vKey = new Map();
const vId = new Array(pos.length / 3);
for (let i = 0; i < pos.length; i += 3) {
    const k = `${pos[i].toFixed(4)},${pos[i + 1].toFixed(4)},${pos[i + 2].toFixed(4)}`;
    if (!vKey.has(k)) vKey.set(k, vKey.size);
    vId[i / 3] = vKey.get(k);
}
const parent = new Array(vKey.size).fill(0).map((_, i) => i);
const find = (a) => (parent[a] === a ? a : (parent[a] = find(parent[a])));
for (let i = 0; i < idx.length; i += 3) {
    for (let e = 0; e < 3; e++) {
        const a = find(vId[idx[i + e]]), b = find(vId[idx[i + (e + 1) % 3]]);
        if (a !== b) parent[a] = b;
    }
}
const compMap = new Map();
for (let i = 0; i < pos.length; i += 3) {
    const r = find(vId[i / 3]);
    if (!compMap.has(r)) compMap.set(r, { mins: [1e9, 1e9, 1e9], maxs: [-1e9, -1e9, -1e9], verts: 0 });
    const c = compMap.get(r);
    c.verts++;
    for (let k = 0; k < 3; k++) {
        c.mins[k] = Math.min(c.mins[k], pos[i + k]);
        c.maxs[k] = Math.max(c.maxs[k], pos[i + k]);
    }
}
const winT = winNode.translation || [0, 0, 0];
const comps = [...compMap.values()].filter((c) => c.verts >= 6).map((c) => {
    const mins = c.mins.map((v, i) => v + winT[i]);
    const maxs = c.maxs.map((v, i) => v + winT[i]);
    const size = maxs.map((v, i) => v - mins[i]);
    const thin = Math.min(...size);
    return {
        mins, maxs, size,
        thinAxis: size.indexOf(thin),
        centroid: mins.map((v, i) => (v + maxs[i]) / 2),
    };
});

// ── 墙面平面检测（与 add_shell_core.mjs 相同）──
const buckets = new Map();
for (const c of comps) {
    if (c.size[c.thinAxis] > 0.12) continue;
    const a = c.thinAxis;
    const b = Math.round(c.centroid[a] * 2) / 2;
    const k = `${a}@${b}`;
    if (!buckets.has(k)) buckets.set(k, { axis: a, sum: 0, count: 0 });
    const bk = buckets.get(k);
    bk.sum += c.centroid[a];
    bk.count++;
}
const planes = [...buckets.values()]
    .filter((b) => b.count >= 10)
    .map((b) => ({ axis: b.axis, value: b.sum / b.count, count: b.count }))
    .filter((p) => (p.axis === 2 && (Math.abs(p.value) >= 3.8
            || (p.value > 0.7 && p.value < 1.2)))
        || (p.axis === 0 && Math.abs(p.value) >= 8.0));

function wallName(p) {
    if (p.axis === 2) {
        if (p.value < -3.8) return '北墙';
        if (p.value > 4.7) return '山墙';
        if (p.value > 3.8) return '两翼前立面';
        return '凹槽里墙';
    }
    return p.value < 0 ? '西侧墙' : '东侧墙';
}

// ── 面内聚类（与 add_shell_core.mjs 相同），簇 = 一扇逻辑窗 ──
const PLANE_TOL = 0.13, GAP_2D = 0.35, COL_GAP = 0.05, ROW_GAP = 0.45;
const windows = [];
for (const plane of planes) {
    const members = comps.filter(
        (c) => Math.abs(c.centroid[plane.axis] - plane.value) <= PLANE_TOL);
    if (!members.length) continue;
    const [u, v] = [0, 1, 2].filter((a) => a !== plane.axis);
    const par = members.map((_, i) => i);
    const fd = (a) => (par[a] === a ? a : (par[a] = fd(par[a])));
    for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
            const A = members[i], B = members[j];
            const gapU = Math.max(0, A.mins[u] - B.maxs[u], B.mins[u] - A.maxs[u]);
            const gapV = Math.max(0, A.mins[v] - B.maxs[v], B.mins[v] - A.maxs[v]);
            if (gapU <= GAP_2D && gapV <= GAP_2D) par[fd(i)] = fd(j);
        }
    }
    const clusters = new Map();
    members.forEach((c, i) => {
        const r = fd(i);
        if (!clusters.has(r)) clusters.set(r, []);
        clusters.get(r).push(c);
    });
    for (const clMembers of clusters.values()) {
        const u0 = Math.min(...clMembers.map((m) => m.mins[u]));
        const u1 = Math.max(...clMembers.map((m) => m.maxs[u]));
        const y0 = Math.min(...clMembers.map((m) => m.mins[v]));
        const y1 = Math.max(...clMembers.map((m) => m.maxs[v]));
        // 列数（并排的窗）与层数（上下分段）
        const cols = [];
        for (const m of [...clMembers].sort((a, b) => a.mins[u] - b.mins[u])) {
            const last = cols[cols.length - 1];
            if (last && m.mins[u] - last.hi <= COL_GAP) last.hi = Math.max(last.hi, m.maxs[u]);
            else cols.push({ lo: m.mins[u], hi: m.maxs[u] });
        }
        const rows = [];
        for (const m of [...clMembers].sort((a, b) => a.mins[v] - b.mins[v])) {
            const last = rows[rows.length - 1];
            if (last && m.mins[v] - last.hi <= ROW_GAP) last.hi = Math.max(last.hi, m.maxs[v]);
            else rows.push({ lo: m.mins[v], hi: m.maxs[v] });
        }
        windows.push({
            wall: wallName(plane),
            planeAxis: 'xyz'[plane.axis], planeValue: +plane.value.toFixed(3),
            uAxis: 'xyz'[u],
            u0: +u0.toFixed(2), u1: +u1.toFixed(2),
            uc: +((u0 + u1) / 2).toFixed(2), width: +(u1 - u0).toFixed(2),
            sill: +y0.toFixed(2), top: +y1.toFixed(2), height: +(y1 - y0).toFixed(2),
            cols: cols.length, rows: rows.length,
        });
    }
}
windows.sort((a, b) => a.wall.localeCompare(b.wall, 'zh') || a.uc - b.uc || a.sill - b.sill);

// ── 输出 ──
console.log(`== ${path} 窗户清单（${windows.length} 扇逻辑窗）==`);
console.log('墙面      平面     u范围          宽   窗台~窗顶      高   列×层');
for (const w of windows) {
    console.log(
        `${w.wall.padEnd(8)} ${w.planeAxis}=${String(w.planeValue).padStart(6)}  `
        + `${String(w.u0).padStart(6)}~${String(w.u1).padEnd(6)}  `
        + `${String(w.width).padStart(4)}  ${String(w.sill).padStart(5)}~${String(w.top).padEnd(5)}  `
        + `${String(w.height).padStart(4)}  ${w.cols}×${w.rows}`);
}
mkdirSync('temp', { recursive: true });
writeFileSync('temp/window_survey.json', JSON.stringify({ source: path, windows }, null, 2));
console.log('\n已写出 temp/window_survey.json');
