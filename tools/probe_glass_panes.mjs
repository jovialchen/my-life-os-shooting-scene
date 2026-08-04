/** 一次性：列出 models/house.glb 里 GLASS_windows 每面玻璃的 bbox
 * （玻璃是每面 8 顶点盒体按顺序写入，直接每 8 个顶点切一段）
 */
import { readFileSync } from 'node:fs';

const buf = readFileSync('models/house.glb');
const jsonLen = buf.readUInt32LE(12);
const gltf = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf-8'));
let off = 20 + jsonLen;
const binLen = buf.readUInt32LE(off);
const bin = buf.subarray(off + 8, off + 8 + binLen);

function readAccessor(idx) {
    const acc = gltf.accessors[idx];
    const bv = gltf.bufferViews[acc.bufferView];
    const start = (bv.byteOffset || 0) + (acc.byteOffset || 0);
    const out = new Float32Array(acc.count * 3);
    for (let i = 0; i < out.length; i++) out[i] = bin.readFloatLE(start + i * 4);
    return out;
}

const node = gltf.nodes.find((n) => n.name === 'GLASS_windows');
const pos = readAccessor(gltf.meshes[node.mesh].primitives[0].attributes.POSITION);
console.log(`总顶点 ${pos.length / 3}，${pos.length / 3 / 8} 面玻璃`);
for (let p = 0; p < pos.length / 24; p++) {
    const mins = [1e9, 1e9, 1e9], maxs = [-1e9, -1e9, -1e9];
    for (let v = 0; v < 8; v++) {
        for (let c = 0; c < 3; c++) {
            const val = pos[(p * 8 + v) * 3 + c];
            mins[c] = Math.min(mins[c], val);
            maxs[c] = Math.max(maxs[c], val);
        }
    }
    const f = (a) => a.map((x) => x.toFixed(2)).join(',');
    console.log(`#${p}  [${f(mins)}] ~ [${f(maxs)}]  size [${f(maxs.map((v, i) => v - mins[i]))}]`);
}
