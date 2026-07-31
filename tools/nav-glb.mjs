/** 共享：解析 GLB（POSITION + indices + 节点平移 + extras）并产出导航用桩 mesh */
import { readFileSync } from 'node:fs';

function parseGlb(path) {
    const buf = readFileSync(path);
    const jsonLen = buf.readUInt32LE(12);
    const gltf = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf-8'));
    let off = 20 + jsonLen;
    const binLen = buf.readUInt32LE(off);
    const bin = buf.subarray(off + 8, off + 8 + binLen);

    const readAccessor = (idx) => {
        const acc = gltf.accessors[idx];
        const bv = gltf.bufferViews[acc.bufferView];
        const start = (bv.byteOffset || 0) + (acc.byteOffset || 0);
        const compSize = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }[acc.componentType];
        const nComp = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[acc.type];
        const out = [];
        for (let i = 0; i < acc.count; i++) {
            const base = start + i * compSize * nComp;
            for (let c = 0; c < nComp; c++) {
                const p = base + c * compSize;
                if (acc.componentType === 5126) out.push(bin.readFloatLE(p));
                else if (acc.componentType === 5123) out.push(bin.readUInt16LE(p));
                else if (acc.componentType === 5125) out.push(bin.readUInt32LE(p));
                else if (acc.componentType === 5121) out.push(bin.readUInt8(p));
                else if (acc.componentType === 5122) out.push(bin.readInt16LE(p));
                else if (acc.componentType === 5120) out.push(bin.readInt8(p));
            }
        }
        return out;
    };

    const nodes = [];
    for (const n of gltf.nodes) {
        if (n.mesh === undefined) continue;
        // 多材质 mesh 会拆成多个 primitive（浏览器端为 Group + 子 mesh）
        for (const prim of gltf.meshes[n.mesh].primitives) {
            const pos = readAccessor(prim.attributes.POSITION);
            const idx = prim.indices !== undefined ? readAccessor(prim.indices) : null;
            nodes.push({
                name: n.name || '',
                extras: n.extras || {},
                pos, idx, translation: n.translation || [0, 0, 0],
            });
        }
    }
    return nodes;
}

function toMesh(node) {
    const arr = node.pos;
    const [tx, ty, tz] = node.translation;
    return {
        name: node.name,
        userData: node.extras,
        geometry: {
            attributes: {
                position: {
                    count: arr.length / 3,
                    getX: (i) => arr[i * 3] + tx,
                    getY: (i) => arr[i * 3 + 1] + ty,
                    getZ: (i) => arr[i * 3 + 2] + tz,
                },
            },
            index: node.idx ? { count: node.idx.length, getX: (i) => node.idx[i] } : null,
        },
        matrixWorld: {},
        updateWorldMatrix() {},
    };
}

export function parseGlbNodes(paths) {
    const walkable = [];
    const obstacles = [];
    const doors = [];
    for (const path of paths) {
        for (const n of parseGlb(path)) {
            if (n.extras.nav_ignore) continue;   // 与 js/systems/surfaceParser.js 一致
            if (n.extras.interactable_type === 'door') {
                doors.push(toMesh(n));
            } else if (n.extras.surface_walkable) {
                walkable.push(toMesh(n));
            } else {
                obstacles.push(toMesh(n));
            }
        }
    }
    return { walkable, obstacles, doors };
}
