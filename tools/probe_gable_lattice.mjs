/** 一次性：列出 WINDOW_01 在山墙平面(z≈4.96)的连通块 bbox（排查玻璃穿出屋顶） */
import { readFileSync } from 'node:fs';

const path = process.argv[2] || 'models/house.nocore.glb';
const buf = readFileSync(path);
const jsonLen = buf.readUInt32LE(12);
const gltf = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf-8'));
let off = 20 + jsonLen;
const binLen = buf.readUInt32LE(off);
const bin = buf.subarray(off + 8, off + 8 + binLen);

function readAccessor(idx) {
    const acc = gltf.accessors[idx];
    const bv = gltf.bufferViews[acc.bufferView];
    const start = (bv.byteOffset || 0) + (acc.byteOffset || 0);
    const compSize = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }[acc.componentType];
    const nComp = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[acc.type];
    const out = new Array(acc.count * nComp);
    for (let i = 0; i < acc.count; i++) {
        for (let c = 0; c < nComp; c++) {
            const p = start + (i * nComp + c) * compSize;
            if (acc.componentType === 5126) out[i * nComp + c] = bin.readFloatLE(p);
            else if (acc.componentType === 5123) out[i * nComp + c] = bin.readUInt16LE(p);
            else if (acc.componentType === 5125) out[i * nComp + c] = bin.readUInt32LE(p);
            else out[i * nComp + c] = bin.readUInt8(p);
        }
    }
    return out;
}

const winNode = gltf.nodes.find((n) => n.name === 'WINDOW_01');
const prim = gltf.meshes[winNode.mesh].primitives[0];
const pos = readAccessor(prim.attributes.POSITION);
const idx = prim.indices !== undefined ? readAccessor(prim.indices) : pos.map((_, i) => i);
const vKey = new Map();
const vId = new Array(pos.length / 3);
for (let i = 0; i < pos.length; i += 3) {
    const k = `${pos[i].toFixed(4)},${pos[i + 1].toFixed(4)},${pos[i + 2].toFixed(4)}`;
    if (!vKey.has(k)) vKey.set(k, vKey.size);
    vId[i / 3] = vKey.get(k);
}
const parent = new Array(vKey.size).fill(0).map((_, i) => i);
const find = (a) => (parent[a] === a ? a : (parent[a] = find(parent[a])));
for (let i = 0; i < idx.length; i += 3)
    for (let e = 0; e < 3; e++) {
        const a = find(vId[idx[i + e]]), b = find(vId[idx[i + (e + 1) % 3]]);
        if (a !== b) parent[a] = b;
    }
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
const list = [...comps.values()].filter((c) => c.n >= 6)
    .map((c) => ({
        n: c.n,
        mins: c.mins.map((v, i) => v + t[i]),
        maxs: c.maxs.map((v, i) => v + t[i]),
    }))
    .filter((c) => (c.mins[2] + c.maxs[2]) / 2 > 4.8)   // 山墙平面 z≈4.96
    .sort((a, b) => a.mins[0] - b.mins[0] || a.mins[1] - b.mins[1]);
console.log(`山墙平面连通块 ${list.length} 个`);
const f = (v) => v.map((x) => x.toFixed(2)).join(',');
for (const c of list) {
    const size = c.maxs.map((v, i) => v - c.mins[i]);
    console.log(`n=${String(c.n).padStart(3)} x[${c.mins[0].toFixed(2)},${c.maxs[0].toFixed(2)}] ` +
        `y[${c.mins[1].toFixed(2)},${c.maxs[1].toFixed(2)}] z[${c.mins[2].toFixed(2)},${c.maxs[2].toFixed(2)}] size[${f(size)}]`);
}
