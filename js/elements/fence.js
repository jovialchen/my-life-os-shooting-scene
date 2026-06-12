/**
 * 圆形草地栅栏 + 拱形门
 * 围绕草地圆周布置木栅栏，相邻立柱之间用绳子连接（2层），
 * 西侧留出拱形门洞，拱门坐在门柱顶端，门柱与相邻柱子也连绳子
 */
import * as THREE from 'three';

// ── 栅栏参数 ──
const POST_RADIUS   = 0.08;    // 立柱半径
const POST_HEIGHT   = 1.2;     // 立柱高度
const POST_SPACING  = 1.8;     // 立柱间距

// ── 绳子参数 ──
const ROPE_RADIUS      = 0.02;   // 绳子截面半径
const ROPE_SAG         = 0.12;   // 绳子下垂幅度
const ROPE_Y_OFFSETS   = [0.35, 0.8];  // 两层绳子的 y 位置
const ROPE_SEGMENTS    = 16;     // 每段绳子的曲线采样数

// ── 门参数 ──
const GATE_WIDTH     = 5.0;    // 门洞宽度（弦长）
const ARCH_HEIGHT    = 3.2;    // 拱顶高度（从门柱顶端算起）
const ARCH_THICKNESS = 0.2;    // 拱圈厚度
const POST_TOP_RADIUS = 0.12;  // 门柱顶部略宽
const GATE_POST_HEIGHT = POST_HEIGHT + ARCH_HEIGHT; // 门柱总高 = 柱身 + 拱高

// ── 材质 ──
const matFencePost = new THREE.MeshStandardMaterial({
    color: 0xb09070,       // 稍深的木色立柱
    roughness: 0.8,
});
const matRope = new THREE.MeshStandardMaterial({
    color: 0xa08060,       // 麻绳色
    roughness: 1.0,
});
const matArch = new THREE.MeshStandardMaterial({
    color: 0xd4c4a8,       // 浅米色拱圈
    roughness: 0.75,
});

/**
 * 创建栅栏 + 拱形门
 * @param {{ centerX: number, centerZ: number, radius: number }} grassInfo
 * @returns {THREE.Group}
 */
export function createFence(grassInfo) {
    const group = new THREE.Group();
    group.name = 'fence';

    const { centerX, centerZ, radius } = grassInfo;

    // 门在西侧（-x 方向）
    const gateCenterAngle = Math.PI;
    const gateHalfAngle = Math.asin(GATE_WIDTH / 2 / radius);
    const leftAngle  = gateCenterAngle + gateHalfAngle;
    const rightAngle = gateCenterAngle - gateHalfAngle;

    // ── 圆周立柱 ──
    const circumference = 2 * Math.PI * radius;
    const postCount = Math.floor(circumference / POST_SPACING);

    // 收集普通立柱位置（角度），用于绑绳子
    const postAngles = [];

    for (let i = 0; i < postCount; i++) {
        const angle = (i / postCount) * Math.PI * 2;

        // 跳过门洞区域
        const angleDiff = normalizeAngle(angle - gateCenterAngle);
        if (Math.abs(angleDiff) < gateHalfAngle + 0.08) continue;

        postAngles.push(angle);

        const x = centerX + radius * Math.cos(angle);
        const z = centerZ + radius * Math.sin(angle);

        // 立柱
        const post = new THREE.Mesh(
            new THREE.CylinderGeometry(POST_RADIUS, POST_RADIUS, POST_HEIGHT, 8),
            matFencePost,
        );
        post.position.set(x, POST_HEIGHT / 2, z);
        post.castShadow = true;
        group.add(post);

        // 立柱顶部小圆帽
        const cap = new THREE.Mesh(
            new THREE.SphereGeometry(POST_RADIUS * 1.3, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
            matFencePost,
        );
        cap.position.set(x, POST_HEIGHT, z);
        group.add(cap);
    }

    // ── 相邻立柱之间绑绳子（2 层）──
    for (let r = 0; r < ROPE_Y_OFFSETS.length; r++) {
        const ropeY = ROPE_Y_OFFSETS[r];
        for (let i = 0; i < postAngles.length; i++) {
            const a0 = postAngles[i];
            const a1 = postAngles[(i + 1) % postAngles.length];

            // 检查是否跨越门洞
            let diff = a1 - a0;
            if (diff < 0) diff += Math.PI * 2;
            if (diff > Math.PI * 2 / postCount * 2) continue;

            addRope(group, centerX, centerZ, radius, a0, a1, ropeY);
        }
    }

    // ── 门柱（两根加粗立柱，与柱子同高，拱门坐在顶端）──
    for (const ang of [leftAngle, rightAngle]) {
        const px = centerX + radius * Math.cos(ang);
        const pz = centerZ + radius * Math.sin(ang);

        // 门柱（与普通柱子同高 POST_HEIGHT）
        const gatePost = new THREE.Mesh(
            new THREE.CylinderGeometry(POST_TOP_RADIUS, POST_RADIUS * 1.2, POST_HEIGHT, 8),
            matFencePost,
        );
        gatePost.position.set(px, POST_HEIGHT / 2, pz);
        gatePost.castShadow = true;
        group.add(gatePost);
    }

    // ── 门柱与相邻柱子之间绑绳子 ──
    // 门洞在 PI 附近，门柱角度 leftAngle > rightAngle
    // 在排序后的角度中找到门洞两侧最近的柱子
    const sortedAngles = postAngles.slice().sort((a, b) => a - b);
    // rightAngle (~3.04) 的邻居是小于它的最大角度（~2.95）
    // leftAngle  (~3.24) 的邻居是大于它的最小角度（~3.33）
    let rightNeighbor = sortedAngles[0];
    let leftNeighbor  = sortedAngles[sortedAngles.length - 1];
    for (let i = 0; i < sortedAngles.length; i++) {
        if (sortedAngles[i] < rightAngle) rightNeighbor = sortedAngles[i];
        if (sortedAngles[i] > leftAngle && (leftNeighbor <= leftAngle || sortedAngles[i] < leftNeighbor)) {
            leftNeighbor = sortedAngles[i];
        }
    }

    for (let r = 0; r < ROPE_Y_OFFSETS.length; r++) {
        const ropeY = ROPE_Y_OFFSETS[r];
        addRope(group, centerX, centerZ, radius, leftAngle, leftNeighbor, ropeY);
        addRope(group, centerX, centerZ, radius, rightAngle, rightNeighbor, ropeY);
    }

    // ── 拱形门楣（坐在门柱顶端）──
    const archGroup = createArch(centerX, centerZ, radius, gateCenterAngle, gateHalfAngle);
    group.add(archGroup);

    return group;
}

/**
 * 添加一段下垂绳子
 */
function addRope(group, centerX, centerZ, radius, angle0, angle1, ropeY) {
    const x0 = centerX + radius * Math.cos(angle0);
    const z0 = centerZ + radius * Math.sin(angle0);
    const x1 = centerX + radius * Math.cos(angle1);
    const z1 = centerZ + radius * Math.sin(angle1);

    const midX = (x0 + x1) / 2;
    const midZ = (z0 + z1) / 2;
    const sagY = ropeY - ROPE_SAG;

    const ropeCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(x0, ropeY, z0),
        new THREE.Vector3(
            midX + (midX - centerX) * 0.02,
            sagY,
            midZ + (midZ - centerZ) * 0.02,
        ),
        new THREE.Vector3(x1, ropeY, z1),
    ]);

    const rope = new THREE.Mesh(
        new THREE.TubeGeometry(ropeCurve, ROPE_SEGMENTS, ROPE_RADIUS, 6, false),
        matRope,
    );
    rope.castShadow = true;
    group.add(rope);
}

/**
 * 创建拱形门楣 + 文字（坐在门柱顶端 POST_HEIGHT 处）
 */
function createArch(centerX, centerZ, radius, gateCenterAngle, gateHalfAngle) {
    const group = new THREE.Group();

    const archSegments = 32;
    const tubeRadius = ARCH_THICKNESS / 2;

    // 拱门底部两点在世界坐标中的位置（门柱顶端）
    const leftAngle  = gateCenterAngle + gateHalfAngle;
    const rightAngle = gateCenterAngle - gateHalfAngle;
    const lx = centerX + radius * Math.cos(leftAngle);
    const lz = centerZ + radius * Math.sin(leftAngle);
    const rx = centerX + radius * Math.cos(rightAngle);
    const rz = centerZ + radius * Math.sin(rightAngle);

    // 弦长（拱门跨度）
    const chordLen = Math.sqrt((lx - rx) ** 2 + (lz - rz) ** 2);
    const archSpan = chordLen / 2;

    // 弦中点（拱门中心）
    const midX = (lx + rx) / 2;
    const midZ = (lz + rz) / 2;

    // 弦方向（右→左）和法线（指向圆外）
    const dx = lx - rx;
    const dz = lz - rz;
    const chordAngle = Math.atan2(dz, dx);

    // 半圆弧路径：沿弦方向展开，底部在 y=0
    const archCurve = new THREE.CatmullRomCurve3(
        Array.from({ length: archSegments + 1 }, (_, i) => {
            const t = i / archSegments;
            const theta = Math.PI * t;
            return new THREE.Vector3(
                -archSpan * Math.cos(theta),
                ARCH_HEIGHT * Math.sin(theta),
                0,
            );
        }),
    );

    const archTube = new THREE.Mesh(
        new THREE.TubeGeometry(archCurve, archSegments, tubeRadius, 8, false),
        matArch,
    );

    // 放到弦中点，旋转使 local x 轴对齐弦方向
    archTube.position.set(midX, POST_HEIGHT, midZ);
    archTube.rotation.y = -chordAngle;
    archTube.castShadow = true;
    group.add(archTube);

    // ── 文字牌匾（挂在拱门下方）──
    const plaqueW = chordLen * 0.8;
    const plaqueH = 0.7;
    // 挂在拱门内侧下方：拱门最高点 = POST_HEIGHT + ARCH_HEIGHT，牌匾挂在稍低于拱顶的位置
    const plaqueY = POST_HEIGHT + ARCH_HEIGHT - plaqueH / 2 - tubeRadius - 0.05;

    const canvas = document.createElement('canvas');
    canvas.width  = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#f5f0e8';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#c4a882';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
    ctx.strokeStyle = '#b09070';
    ctx.lineWidth = 3;
    ctx.strokeRect(14, 14, canvas.width - 28, canvas.height - 28);

    ctx.fillStyle = '#3d2b1f';
    ctx.font = 'bold 80px "Georgia", "Times New Roman", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Life OS Studio', canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;

    // 内侧牌子需要水平翻转文字（因为 PlaneGeometry 从背面看是镜像的）
    const canvasInner = document.createElement('canvas');
    canvasInner.width  = 1024;
    canvasInner.height = 256;
    const ctxInner = canvasInner.getContext('2d');
    ctxInner.translate(canvasInner.width, 0);
    ctxInner.scale(-1, 1);
    ctxInner.drawImage(canvas, 0, 0);
    const textureInner = new THREE.CanvasTexture(canvasInner);
    textureInner.minFilter = THREE.LinearFilter;

    const plaqueMatOuter = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.6 });
    const plaqueMatInner = new THREE.MeshStandardMaterial({ map: textureInner, roughness: 0.6 });
    const plaqueBackMat = new THREE.MeshStandardMaterial({ color: 0xf5f0e8, roughness: 0.6 });
    const plaqueGeo = new THREE.PlaneGeometry(plaqueW, plaqueH);

    // 拱门内外方向（指向圆心 = 内侧，背离圆心 = 外侧）
    const toCenterLen = Math.sqrt((centerX - midX) ** 2 + (centerZ - midZ) ** 2);
    const dirX = (centerX - midX) / toCenterLen;
    const dirZ = (centerZ - midZ) / toCenterLen;

    // 两块牌子：内侧（朝房子）+ 外侧（朝外）
    for (const side of [-1, 1]) {
        const pGroup = new THREE.Group();

        // 底板
        const body = new THREE.Mesh(
            new THREE.BoxGeometry(plaqueW, plaqueH, 0.06),
            plaqueBackMat,
        );
        pGroup.add(body);

        // 内侧牌子用翻转纹理，面朝 -z（房子方向）
        // 外侧牌子用原始纹理，面朝 +z（外面方向）
        const faceMat = side === -1 ? plaqueMatInner : plaqueMatOuter;
        const face = new THREE.Mesh(plaqueGeo, faceMat);
        face.position.z = side * 0.031;
        if (side === -1) face.rotation.y = Math.PI; // 内侧翻转，法线朝房子
        pGroup.add(face);

        const offX = dirX * (tubeRadius + 0.06) * side;
        const offZ = dirZ * (tubeRadius + 0.06) * side;
        pGroup.position.set(midX + offX, plaqueY, midZ + offZ);
        pGroup.rotation.y = -chordAngle;
        pGroup.castShadow = true;
        group.add(pGroup);
    }

    return group;
}

function normalizeAngle(a) {
    while (a > Math.PI)  a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
}
