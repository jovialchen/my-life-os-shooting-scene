/** 探查 models/house.glb：列出节点 + WINDOW_01 格栅连通块 bbox（glTF 坐标系，Y 上）
 *
 * 用法: node tools/probe_glb_windows.mjs [glb路径]
 */
import { readFileSync } from 'node:fs';

const path = process.argv[2] || 'models/house.glb';

function parseGlb(path) {
    const buf = readFileSync(path);
    const jsonLen = buf.readUInt32LE(12);
    const gltf = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf-8'));
    let off = 20 + jsonLen;
    const binLen = buf.readUInt32LE(off);
    const bin = buf.subarray(off + 8, off + 8 + binLen);
    return { gltf, bin };
}

const { gltf, bin } = parseGlb(path);

function readAccessor(idx) {
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

console.log(`== ${path} ==`);
console.log('materials:', (gltf.materials || []).map((m, i) => `${i}:${m.name}`).join('  '));

for (const n of gltf.nodes) {
    if (n.mesh === undefined) continue;
    let mins = [1e9, 1e9, 1e9], maxs = [-1e9, -1e9, -1e9], nverts = 0;
    for (const prim of gltf.meshes[n.mesh].primitives) {
        const pos = readAccessor(prim.attributes.POSITION);
        nverts += pos.length / 3;
        for (let i = 0; i < pos.length; i += 3)
            for (let c = 0; c < 3; c++) {
                mins[c] = Math.min(mins[c], pos[i + c]);
                maxs[c] = Math.max(maxs[c], pos[i + c]);
            }
    }
    const t = n.translation || [0, 0, 0];
    const f = (v) => v.map((x) => x.toFixed(2)).join(',');
    console.log(`${(n.name || '?').padEnd(22)} verts=${String(nverts).padStart(6)} ` +
        `bbox [${f(mins.map((v, i) => v + t[i]))}] ~ [${f(maxs.map((v, i) => v + t[i]))}] ` +
        `extras=${JSON.stringify(n.extras || {})}`);
}

// ── WINDOW_01 格栅连通块分析（按共享顶点聚类三角形）──
const winNode = gltf.nodes.find((n) => n.name === 'WINDOW_01');
if (!winNode) { console.log('\n无 WINDOW_01 节点'); process.exit(0); }

const pos = readAccessor(gltf.meshes[winNode.mesh].primitives[0].attributes.POSITION);
const prim0 = gltf.meshes[winNode.mesh].primitives[0];
const idx = prim0.indices !== undefined ? readAccessor(prim0.indices) : pos.map((_, i) => Math.floor(i / 1));

// 顶点位置 -> 去重 id
const vKey = new Map();
const vId = new Array(pos.length / 3);
for (let i = 0; i < pos.length; i += 3) {
    const k = `${pos[i].toFixed(4)},${pos[i + 1].toFixed(4)},${pos[i + 2].toFixed(4)}`;
    if (!vKey.has(k)) vKey.set(k, vKey.size);
    vId[i / 3] = vKey.get(k);
}
// union-find
const parent = new Array(vKey.size).fill(0).map((_, i) => i);
const find = (a) => (parent[a] === a ? a : (parent[a] = find(parent[a])));
for (let i = 0; i < idx.length; i += 3)
    for (let e = 0; e < 3; e++) {
        const a = find(vId[idx[i + e]]), b = find(vId[idx[i + (e + 1) % 3]]);
        if (a !== b) parent[a] = b;
    }
// 汇总
const comps = new Map();
for (let i = 0; i < pos.length; i += 3) {
    const r = find(vId[i / 3]);
    if (!comps.has(r)) comps.set(r, { n: 0, mins: [1e9, 1e9, 1e9], maxs: [-1e9, -1e9, -1e9] });
    const c = comps.get(r);
    c.n++;
    for (let k = 0; k < 3; k++) {
        c.mins[k] = Math.min(c.mins[k], pos[i + k]);
        c.maxs[k] = Math.max(c.maxs[k], pos[i + k]);
    }
}
const t = winNode.translation || [0, 0, 0];
console.log(`\n== WINDOW_01 连通块 ${comps.size} 个 ==`);
const list = [...comps.values()].filter((c) => c.n >= 6)
    .sort((a, b) => a.mins[2] - b.mins[2] || a.mins[0] - b.mins[0]);
for (const c of list) {
    const f = (v) => v.map((x) => x.toFixed(2)).join(',');
    const size = c.maxs.map((v, i) => v - c.mins[i]);
    console.log(`verts=${String(c.n).padStart(4)} bbox [${f(c.mins.map((v, i) => v + t[i]))}] ~ ` +
        `[${f(c.maxs.map((v, i) => v + t[i]))}] size [${f(size)}]`);
}
