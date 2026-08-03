/** 阶段 2：室外房子外壳加 黑色内胆 + 实色玻璃（GLB 后处理，无需 Blender）
 *
 * 背景：house 四步 Blender 管线（split_house → fill_gaps → add_walkable →
 * add_door）产物为 models/house.glb。本脚本是其后的第五步。
 * 原计划用 Blender 脚本实现，但当前设备无 Blender，改为纯 Node 的 GLB 后
 * 处理（几何只是盒体/棱柱，无需 Blender 建模能力）。若重新跑 Blender 管
 * 线重生了 house.glb，删掉 models/house.nocore.glb 备份后重跑本脚本即可。
 *
 * 做的事：
 * 1. GLASS_windows：窗户洞口填不透明玻璃面片（材质 MAT_window_glass，
 *    淡蓝灰平涂，后续时间系统按名联动变色）。面片位置从 WINDOW_01 格栅
 *    连通块自动聚类得出：按墙面平面分组（质心落在墙面 ±0.13 内），
 *    面内 bbox 间隙 ≤0.35 的连片成一面玻璃。厚度 0.07 居中嵌进墙腔，
 *    比格栅（0.11）薄，避免与格栅共面 z-fight；面内四周外扩 0.08 埋入
 *    窗框/墙体。楼梯扶手格栅不在外墙平面，自动跳过。
 *    注意 WINDOW_01 节点带 translation [0,~5.8,0]，聚类用世界坐标。
 * 2. CORE_black：比外壳内表面略小的黑色内胆（材质 MAT_core_black，
 *    doubleSided），从门窗洞口看进去是纯黑。按实测平面轮廓分三个盒体
 *    （两翼 + 中厅凹槽，凹槽里墙在 z≈1.0、门廊 z 1..4 保持开敞），
 *    顶 y=6.02 低于屋顶 eave；阁楼不放内胆（山墙窗由实色玻璃封死，
 *    棱柱会穿出翼屋顶——已踩坑）。
 *    不删内饰：旧室内导航/机位在阶段 3+ 才退役，内饰被内胆挡住不可见，
 *    删除只会破坏 test-nav-real 回归。
 *
 * 两个新节点都标 nav_ignore（不进导航网格，不封门洞）。
 *
 * 幂等：首次运行先把原 house.glb 备份为 models/house.nocore.glb，
 * 之后一律从备份出发重写 house.glb。
 *
 * 用法: node tools/add_shell_core.mjs
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

const GLB = 'models/house.glb';
const BACKUP = 'models/house.nocore.glb';

// ── GLB 读写 ──
function parseGlb(path) {
    const buf = readFileSync(path);
    if (buf.readUInt32LE(0) !== 0x46546C67) throw new Error('不是 GLB');
    const jsonLen = buf.readUInt32LE(12);
    const gltf = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf-8'));
    let off = 20 + jsonLen;
    const binLen = buf.readUInt32LE(off);
    const bin = Buffer.from(buf.subarray(off + 8, off + 8 + binLen));
    return { gltf, bin };
}

function writeGlb(path, gltf, bin) {
    let json = Buffer.from(JSON.stringify(gltf), 'utf-8');
    const jsonPad = (4 - (json.length % 4)) % 4;
    if (jsonPad) json = Buffer.concat([json, Buffer.alloc(jsonPad, 0x20)]);
    const binPad = (4 - (bin.length % 4)) % 4;
    if (binPad) bin = Buffer.concat([bin, Buffer.alloc(binPad)]);
    const total = 12 + 8 + json.length + 8 + bin.length;
    const head = Buffer.alloc(12);
    head.writeUInt32LE(0x46546C67, 0);
    head.writeUInt32LE(2, 4);
    head.writeUInt32LE(total, 8);
    const jh = Buffer.alloc(8);
    jh.writeUInt32LE(json.length, 0);
    jh.writeUInt32LE(0x4E4F534A, 4);   // 'JSON'
    const bh = Buffer.alloc(8);
    bh.writeUInt32LE(bin.length, 0);
    bh.writeUInt32LE(0x004E4942, 4);   // 'BIN\0'
    writeFileSync(path, Buffer.concat([head, jh, json, bh, bin]));
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

// sRGB hex -> glTF baseColorFactor（线性）
function hexToLinear(hex) {
    const h = hex.replace('#', '');
    const f = (i) => {
        const c = parseInt(h.slice(i, i + 2), 16) / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return [f(0), f(2), f(4), 1];
}

// ── 1. 读源（备份优先，保证幂等）──
if (!existsSync(BACKUP)) {
    copyFileSync(GLB, BACKUP);
    console.log(`备份原模型 -> ${BACKUP}`);
}
const { gltf, bin } = parseGlb(BACKUP);
if (gltf.nodes.some((n) => n.name === 'CORE_black' || n.name === 'GLASS_windows')) {
    throw new Error('备份里已含 CORE_black/GLASS_windows，备份被污染，请从管线重新导出 house.glb 并删除备份');
}

// ── 2. WINDOW_01 格栅连通块（按共享顶点 union-find）──
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
const compMap = new Map();   // root -> {mins,maxs,verts}
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
// WINDOW_01 节点带 translation（[0,~5.8,0]），聚类/出图一律用世界坐标
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
console.log(`WINDOW_01 连通块 ${comps.length} 个`);

// ── 3. 墙面平面检测：薄件质心在薄轴上的分布，>=10 件的桶是一个窗平面 ──
const buckets = new Map();   // "axis@bucket" -> {axis, sum, count}
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
    // 只留外墙窗平面：z 向——北墙 |z|>=3.8、两翼前立面 z≈4.0、山墙 z≈5.0，
    // 以及中庭凹槽墙 z≈1.0（凹槽门廊的里墙，也是外墙）；
    // x 向侧墙 |x|>=8.0。楼梯扶手（x -5.4..-0.5，薄轴 x/z 均不靠墙）自动排除。
    .filter((p) => (p.axis === 2 && (Math.abs(p.value) >= 3.8
            || (p.value > 0.7 && p.value < 1.2)))
        || (p.axis === 0 && Math.abs(p.value) >= 8.0));
console.log('外墙窗平面:', planes.map((p) => `${'xyz'[p.axis]}=${p.value.toFixed(3)} (${p.count}件)`).join('  '));

// ── 4. 把全部格栅件（含薄百叶/竖梃）按质心归到平面，再面内聚类 ──
const PLANE_TOL = 0.13;    // 质心离平面超过此值不算该墙（扶手 z=-4.85 vs 北墙 -4.985 被排除）
const GAP_2D = 0.35;       // 面内 bbox 间隙 <= 此值连成一面玻璃（窗梃缝 0.08、上下段缝 0.23）
const PAD_2D = 0.08;       // 面内四周外扩，埋进窗框/墙
const GLASS_HALF = 0.035;  // 玻璃半厚（0.07，比格栅 0.11 薄，避免共面）

const panels = [];
for (const plane of planes) {
    const members = comps.filter(
        (c) => Math.abs(c.centroid[plane.axis] - plane.value) <= PLANE_TOL);
    if (!members.length) continue;
    // 面内两轴
    const [u, v] = [0, 1, 2].filter((a) => a !== plane.axis);
    // union-find（成员级）
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
        if (!clusters.has(r)) clusters.set(r, { mins: [...c.mins], maxs: [...c.maxs] });
        const cl = clusters.get(r);
        for (let k = 0; k < 3; k++) {
            cl.mins[k] = Math.min(cl.mins[k], c.mins[k]);
            cl.maxs[k] = Math.max(cl.maxs[k], c.maxs[k]);
        }
    });
    for (const cl of clusters.values()) {
        const box = { mins: [...cl.mins], maxs: [...cl.maxs] };
        box.mins[u] -= PAD_2D; box.maxs[u] += PAD_2D;
        box.mins[v] -= PAD_2D; box.maxs[v] += PAD_2D;
        box.mins[plane.axis] = plane.value - GLASS_HALF;
        box.maxs[plane.axis] = plane.value + GLASS_HALF;
        panels.push(box);
    }
    console.log(`平面 ${'xyz'[plane.axis]}=${plane.value.toFixed(3)}: `
        + `${members.length} 件 -> ${clusters.size} 面玻璃`);
}

// ── 5. 几何生成：盒体 / 三棱柱 -> 合并顶点表 ──
function pushBox(verts, tris, mins, maxs) {
    const b = verts.length / 3;
    const [x0, y0, z0] = mins, [x1, y1, z1] = maxs;
    verts.push(
        x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0,   // 0-3  front z0
        x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1);  // 4-7  back  z1
    const Q = (a, c, d, e) => tris.push(a, c, d, a, d, e);
    Q(b + 0, b + 1, b + 2, b + 3);   // z0 面
    Q(b + 5, b + 4, b + 7, b + 6);   // z1 面
    Q(b + 4, b + 0, b + 3, b + 7);   // x0 面
    Q(b + 1, b + 5, b + 6, b + 2);   // x1 面
    Q(b + 3, b + 2, b + 6, b + 7);   // y1 面
    Q(b + 4, b + 5, b + 1, b + 0);   // y0 面
}

// 玻璃：每面一片盒体，合并为一个 mesh
const glassVerts = [], glassTris = [];
for (const p of panels) pushBox(glassVerts, glassTris, p.mins, p.maxs);

// 黑色内胆：按实测平面轮廓的三个盒体（1F/2F，顶 y=6.02 在屋顶 eave 6.06 之下）
//   两翼：前墙 z 3.85..4.05 → 盒前缘 3.68；凹槽侧墙 x≈±3.7 → 盒内缘 ±3.75
//   中厅：凹槽里墙 z≈0.9..1.1 → 盒前缘 0.78（门廊/阳台在 z 1..4 保持开敞）
//   北墙内壁 z≈-4.85 → 盒后缘 -4.72；侧墙内壁 |x|≈9.55 → 盒外缘 ±9.30
// 阁楼（y>6.1）不放内胆：山墙窗已被实色玻璃封死，棱柱会穿出复杂的翼屋顶。
const coreVerts = [], coreTris = [];
pushBox(coreVerts, coreTris, [-9.30, -0.30, -4.72], [-3.75, 6.02, 3.68]);  // 西翼
pushBox(coreVerts, coreTris, [3.75, -0.30, -4.72], [9.30, 6.02, 3.68]);    // 东翼
pushBox(coreVerts, coreTris, [-3.80, -0.30, -4.72], [3.80, 6.02, 0.78]);   // 中厅

// ── 6. 写回 GLB：追加 bufferView/accessor/mesh/material/node ──
function appendGeometry(gltf, bin, verts, tris, matIdx) {
    const vbuf = Buffer.alloc(verts.length * 4);
    verts.forEach((v, i) => vbuf.writeFloatLE(v, i * 4));
    const ibuf = Buffer.alloc(tris.length * 4);
    tris.forEach((v, i) => ibuf.writeUInt32LE(v, i * 4));
    const blob = Buffer.concat([bin, vbuf, ibuf]);
    const bvBase = gltf.bufferViews.length;
    gltf.bufferViews.push(
        { buffer: 0, byteOffset: bin.length, byteLength: vbuf.length },
        { buffer: 0, byteOffset: bin.length + vbuf.length, byteLength: ibuf.length },
    );
    const mins = [0, 1, 2].map((k) => Math.min(...verts.filter((_, i) => i % 3 === k)));
    const maxs = [0, 1, 2].map((k) => Math.max(...verts.filter((_, i) => i % 3 === k)));
    const acBase = gltf.accessors.length;
    gltf.accessors.push(
        { bufferView: bvBase, componentType: 5126, count: verts.length / 3, type: 'VEC3', min: mins, max: maxs },
        { bufferView: bvBase + 1, componentType: 5125, count: tris.length, type: 'SCALAR' },
    );
    gltf.meshes.push({
        primitives: [{ attributes: { POSITION: acBase }, indices: acBase + 1, material: matIdx }],
    });
    return { meshIdx: gltf.meshes.length - 1, blob };
}

gltf.materials.push(
    {
        name: 'MAT_window_glass',
        pbrMetallicRoughness: {
            baseColorFactor: hexToLinear('#9FB4BE'),   // 淡蓝灰平涂
            roughnessFactor: 1.0,
            metallicFactor: 0.0,
        },
    },
    {
        name: 'MAT_core_black',
        doubleSided: true,
        pbrMetallicRoughness: {
            baseColorFactor: hexToLinear('#050505'),
            roughnessFactor: 1.0,
            metallicFactor: 0.0,
        },
    },
);
const matGlass = gltf.materials.length - 2;
const matCore = gltf.materials.length - 1;

let blob = bin;
const g1 = appendGeometry(gltf, blob, glassVerts, glassTris, matGlass);
blob = g1.blob;
const g2 = appendGeometry(gltf, blob, coreVerts, coreTris, matCore);
blob = g2.blob;

const nodeBase = gltf.nodes.length;
gltf.nodes.push(
    { name: 'GLASS_windows', mesh: g1.meshIdx, extras: { nav_ignore: true } },
    { name: 'CORE_black', mesh: g2.meshIdx, extras: { nav_ignore: true } },
);
const scene = gltf.scenes[gltf.scene || 0];
scene.nodes.push(nodeBase, nodeBase + 1);

// ── 7. 门=传送点（阶段 3.3 / 5）：西大门 -> 客厅，东大门 -> 厨房 ──
const westDoor = gltf.nodes.find((n) => n.name === 'DOOR_entrance');
if (!westDoor) throw new Error('找不到 DOOR_entrance 节点');
Object.assign(westDoor.extras ??= {}, {
    door_target_scene: 'f1_living',
    door_target_spawn: 'default',
});
console.log('DOOR_entrance -> f1_living 传送已标记');
const eastDoor = gltf.nodes.find((n) => n.name === 'DOOR_entrance_east');
if (!eastDoor) throw new Error('找不到 DOOR_entrance_east 节点');
Object.assign(eastDoor.extras ??= {}, {
    door_target_scene: 'f1_kitchen',
    door_target_spawn: 'fromOutdoor',
});
console.log('DOOR_entrance_east -> f1_kitchen 传送已标记');
gltf.buffers[0].byteLength = blob.length;

writeGlb(GLB, gltf, blob);
console.log(`\nGLASS_windows: ${panels.length} 面玻璃, ${glassVerts.length / 3} 顶点`);
console.log(`CORE_black: 两翼+中厅 3 盒体, ${coreVerts.length / 3} 顶点`);
console.log(`已写出 ${GLB}`);
