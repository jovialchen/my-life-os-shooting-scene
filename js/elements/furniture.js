/**
 * 家具工厂：沙沙/椅子/茶几/边桌/书架/落地灯
 *
 * 所有家具统一接口：
 *   createXXX({ position?, rotation?, ... }) → THREE.Group | { group, children, light }
 *
 * 工厂只管"建"，不管"放"。位置和旋转由配置层决定。
 * 不读取任何全局房间常量。
 */
import * as THREE from 'three';
import { matFabric, matFabricA, matWood, matMetal, matCushion, matLampSh, matWall, matBook1, matBook2, matBook3 } from '../materials.js';
import { createBook } from './smallItems.js';
import { createCushion } from './smallItems.js';


// ============================================================
//  沙发
// ============================================================

const SOFA = {
    width: 2.4, depth: 0.9,
    baseHeight: 0.4, baseY: 0.35,
    backHeight: 0.7, backThick: 0.15, backY: 0.85, backZ: -0.375,
    armWidth: 0.15, armHeight: 0.5, armY: 0.6, armX: 1.125,
    legRadius: 0.04, legHeight: 0.15, legScaleX: 1.05, legY: 0.075, legX: 1.0, legZ: 0.3,
};

const SOFA_CUSHION = {
    size: 0.4, depth: 0.15, y: 0.8, z: -0.2,
    leftX: -0.7, rightX: 0.7, rotL: 0.15, rotR: -0.1,
};

/**
 * @param {{ position?: {x,y,z}, rotation?: number }} opts
 * @returns {{ sofa: THREE.Group, cushions: THREE.Group[] }}
 */
export function createSofa({ position, rotation } = {}) {
    const sofa = new THREE.Group();

    // 底座
    const base = new THREE.Mesh(new THREE.BoxGeometry(SOFA.width, SOFA.baseHeight, SOFA.depth), matFabric);
    base.position.y = SOFA.baseY;
    base.castShadow = true;
    sofa.add(base);

    // 靠背
    const back = new THREE.Mesh(new THREE.BoxGeometry(SOFA.width, SOFA.backHeight, SOFA.backThick), matFabric);
    back.position.set(0, SOFA.backY, SOFA.backZ);
    back.castShadow = true;
    sofa.add(back);

    // 扶手 ×2
    const armGeo = new THREE.BoxGeometry(SOFA.armWidth, SOFA.armHeight, SOFA.depth);
    [-SOFA.armX, SOFA.armX].forEach(x => {
        const arm = new THREE.Mesh(armGeo, matFabric);
        arm.position.set(x, SOFA.armY, 0);
        arm.castShadow = true;
        sofa.add(arm);
    });

    // 腿 ×4
    const legGeo = new THREE.CylinderGeometry(SOFA.legRadius, SOFA.legRadius, SOFA.legHeight);
    [[-SOFA.legX, -SOFA.legZ], [-SOFA.legX, SOFA.legZ], [SOFA.legX, -SOFA.legZ], [SOFA.legX, SOFA.legZ]].forEach(([x, z]) => {
        const leg = new THREE.Mesh(legGeo, matWood);
        leg.position.set(x * SOFA.legScaleX, SOFA.legY, z);
        leg.castShadow = true;
        sofa.add(leg);
    });

    if (position) sofa.position.set(position.x, position.y || 0, position.z);
    if (rotation != null) sofa.rotation.y = rotation;

    // 靠枕（独立小物品，世界坐标）
    const sofaQuat = sofa.quaternion;
    const sofaPos = sofa.position;
    const c = SOFA_CUSHION;

    function makeCushion(material, localX, localZ, rotZ) {
        const group = createCushion({ material });
        const local = new THREE.Vector3(localX, c.y, localZ);
        local.applyQuaternion(sofaQuat).add(sofaPos);
        group.position.copy(local);
        group.rotation.z = rotZ;
        group.rotation.y = sofa.rotation.y;
        return group;
    }

    const cushion1 = makeCushion(matCushion, c.leftX, c.z, c.rotL);
    const cushion2 = makeCushion(matFabricA, c.rightX, c.z, c.rotR);

    return { sofa, cushions: [cushion1, cushion2] };
}


// ============================================================
//  椅子
// ============================================================

const CHAIR = {
    seatWidth: 0.6, seatThick: 0.06, seatDepth: 0.55, seatY: 0.5,
    backHeight: 0.6, backThick: 0.06, backY: 0.83, backZ: -0.245,
    legRadius: 0.03, legHeight: 0.47, legX: 0.25, legZ: 0.2, legY: 0.235,
};

/**
 * @param {{ position?: {x,y,z}, rotation?: number }} opts
 * @returns {THREE.Group}
 */
export function createChair({ position, rotation } = {}) {
    const chair = new THREE.Group();

    const seat = new THREE.Mesh(new THREE.BoxGeometry(CHAIR.seatWidth, CHAIR.seatThick, CHAIR.seatDepth), matFabricA);
    seat.position.y = CHAIR.seatY;
    seat.castShadow = true;
    chair.add(seat);

    const back = new THREE.Mesh(new THREE.BoxGeometry(CHAIR.seatWidth, CHAIR.backHeight, CHAIR.backThick), matFabricA);
    back.position.set(0, CHAIR.backY, CHAIR.backZ);
    back.castShadow = true;
    chair.add(back);

    const legGeo = new THREE.CylinderGeometry(CHAIR.legRadius, CHAIR.legRadius, CHAIR.legHeight);
    [[-CHAIR.legX, -CHAIR.legZ], [-CHAIR.legX, CHAIR.legZ], [CHAIR.legX, -CHAIR.legZ], [CHAIR.legX, CHAIR.legZ]].forEach(([x, z]) => {
        const leg = new THREE.Mesh(legGeo, matWood);
        leg.position.set(x, CHAIR.legY, z);
        leg.castShadow = true;
        chair.add(leg);
    });

    if (position) chair.position.set(position.x, position.y || 0, position.z);
    if (rotation != null) chair.rotation.y = rotation;
    return chair;
}


// ============================================================
//  茶几
// ============================================================

const COFFEE_TABLE = {
    topRadius: 0.55, topThick: 0.05, topSegments: 32, topY: 0.45,
    legRadius: 0.03, legHeight: 0.42, legSegments: 8, legOrbit: 0.35, legY: 0.22, legCount: 3,
};

/**
 * @param {{ position?: {x,y,z}, rotation?: number }} opts
 * @returns {THREE.Group}
 */
export function createCoffeeTable({ position, rotation } = {}) {
    const table = new THREE.Group();

    const top = new THREE.Mesh(
        new THREE.CylinderGeometry(COFFEE_TABLE.topRadius, COFFEE_TABLE.topRadius, COFFEE_TABLE.topThick, COFFEE_TABLE.topSegments),
        matWood,
    );
    top.position.y = COFFEE_TABLE.topY;
    top.castShadow = true;
    top.receiveShadow = true;
    table.add(top);

    for (let i = 0; i < COFFEE_TABLE.legCount; i++) {
        const a = (i / COFFEE_TABLE.legCount) * Math.PI * 2;
        const leg = new THREE.Mesh(
            new THREE.CylinderGeometry(COFFEE_TABLE.legRadius, COFFEE_TABLE.legRadius, COFFEE_TABLE.legHeight, COFFEE_TABLE.legSegments),
            matMetal,
        );
        leg.position.set(Math.cos(a) * COFFEE_TABLE.legOrbit, COFFEE_TABLE.legY, Math.sin(a) * COFFEE_TABLE.legOrbit);
        leg.castShadow = true;
        table.add(leg);
    }

    if (position) table.position.set(position.x, position.y || 0, position.z);
    if (rotation != null) table.rotation.y = rotation;
    return table;
}


// ============================================================
//  边桌
// ============================================================

const SIDE_TABLE = {
    topRadius: 0.3, topThick: 0.04, topSegments: 24, topY: 0.65,
    legRadius: 0.04, legHeight: 0.62, legSegments: 8, legY: 0.32,
    footRadius: 0.18, footThick: 0.03, footSegments: 24, footY: 0.015,
};

/**
 * @param {{ position?: {x,y,z}, rotation?: number }} opts
 * @returns {{ table: THREE.Group, book: THREE.Group }}
 */
export function createSideTable({ position, rotation } = {}) {
    const table = new THREE.Group();

    const top = new THREE.Mesh(
        new THREE.CylinderGeometry(SIDE_TABLE.topRadius, SIDE_TABLE.topRadius, SIDE_TABLE.topThick, SIDE_TABLE.topSegments),
        matWood,
    );
    top.position.y = SIDE_TABLE.topY;
    top.castShadow = true;
    top.receiveShadow = true;
    table.add(top);

    const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(SIDE_TABLE.legRadius, SIDE_TABLE.legRadius, SIDE_TABLE.legHeight, SIDE_TABLE.legSegments),
        matMetal,
    );
    leg.position.y = SIDE_TABLE.legY;
    leg.castShadow = true;
    table.add(leg);

    const foot = new THREE.Mesh(
        new THREE.CylinderGeometry(SIDE_TABLE.footRadius, SIDE_TABLE.footRadius, SIDE_TABLE.footThick, SIDE_TABLE.footSegments),
        matMetal,
    );
    foot.position.y = SIDE_TABLE.footY;
    table.add(foot);

    const pos = position || { x: 0, y: 0, z: 0 };
    table.position.set(pos.x, pos.y || 0, pos.z);
    if (rotation != null) table.rotation.y = rotation;

    // 书本 — 独立小物品，世界坐标
    const book = createBook({
        position: { x: pos.x + 0.05, y: (pos.y || 0) + 0.7, z: pos.z },
        rotation: 0.3,
        width: 0.15, height: 0.06, depth: 0.2,
        material: matBook1,
    });

    return { table, book };
}


// ============================================================
//  书架
// ============================================================

const BOOKSHELF = {
    width: 1.2, height: 2.0, depth: 0.35,
    plankThick: 0.04, shelfCount: 3, backThick: 0.02, backOffset: 0.01,
    bookMinCount: 3, bookRandomCount: 3,
    bookStartX: 0.12,
    bookMinWidth: 0.06, bookRandomWidth: 0.06,
    bookMinHeight: 0.2, bookRandomHeight: 0.1,
    bookDepth: 0.18, bookGap: 0.01, bookYOffset: 0.04,
};

/**
 * @param {{ position?: {x,y,z}, rotation?: number }} opts
 * @returns {{ shelf: THREE.Group, books: THREE.Group[] }}
 */
export function createBookshelf({ position, rotation } = {}) {
    const shelf = new THREE.Group();
    const books = [];

    const D = BOOKSHELF;
    const pos = position || { x: 0, y: 0, z: 0 };

    // 侧板 ×2
    [-1, 1].forEach(side => {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(D.plankThick, D.height, D.depth), matWood);
        panel.position.set(side * (D.width / 2), D.height / 2, 0);
        panel.castShadow = true;
        shelf.add(panel);
    });

    // 层板 ×4
    for (let i = 0; i <= D.shelfCount; i++) {
        const plank = new THREE.Mesh(new THREE.BoxGeometry(D.width, D.plankThick, D.depth), matWood);
        plank.position.y = i * (D.height / D.shelfCount) + D.plankThick / 2;
        plank.receiveShadow = true;
        plank.castShadow = true;
        shelf.add(plank);
    }

    // 背板
    const backPanel = new THREE.Mesh(new THREE.BoxGeometry(D.width, D.height, D.backThick), matWall);
    backPanel.position.set(0, D.height / 2, -D.depth / 2 + D.backOffset);
    shelf.add(backPanel);

    shelf.position.set(pos.x, pos.y || 0, pos.z);
    if (rotation != null) shelf.rotation.y = rotation;

    // 随机书本（每层 3~5 本）— 独立小物品
    const bookMats = [matBook1, matBook2, matBook3];
    for (let row = 0; row < D.shelfCount; row++) {
        const y = row * (D.height / D.shelfCount) + D.plankThick + D.bookYOffset;
        const count = D.bookMinCount + Math.floor(Math.random() * D.bookRandomCount);
        let localX = -D.width / 2 + D.bookStartX;
        for (let b = 0; b < count; b++) {
            const bw = D.bookMinWidth + Math.random() * D.bookRandomWidth;
            const bh = D.bookMinHeight + Math.random() * D.bookRandomHeight;
            // 书架旋转后坐标变换
            const bookX = pos.x;
            const bookY = (pos.y || 0) + y + bh / 2;
            const bookZ = pos.z - (localX + bw / 2);
            books.push(createBook({
                position: { x: bookX, y: bookY, z: bookZ },
                rotationX: Math.PI / 2,
                width: D.bookDepth, height: bw, depth: bh,
                material: bookMats[b % 3],
                state: 'standing',
            }));
            localX += bw + D.bookGap;
        }
    }

    return { shelf, books };
}


// ============================================================
//  落地灯
// ============================================================

const FLOOR_LAMP = {
    baseTopRadius: 0.2, baseBottomRadius: 0.22, baseHeight: 0.04, baseSegments: 24, baseY: 0.02,
    poleRadius: 0.03, poleHeight: 1.7, poleSegments: 12, poleY: 0.89,
    shadeRadius: 0.25, shadeHeight: 0.35, shadeSegments: 24, shadeY: 1.85,
    bulbColor: 0xffcc77, bulbIntensity: 1.5, bulbDistance: 6, bulbY: 1.75,
    bulbShadowMapSize: 512, bulbShadowRadius: 4,
};

/**
 * @param {{ position?: {x,y,z}, rotation?: number }} opts
 * @returns {{ group: THREE.Group, light: THREE.PointLight }}
 */
export function createFloorLamp({ position, rotation } = {}) {
    const lamp = new THREE.Group();
    const D = FLOOR_LAMP;

    const base = new THREE.Mesh(
        new THREE.CylinderGeometry(D.baseTopRadius, D.baseBottomRadius, D.baseHeight, D.baseSegments),
        matMetal,
    );
    base.position.y = D.baseY;
    base.castShadow = true;
    lamp.add(base);

    const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(D.poleRadius, D.poleRadius, D.poleHeight, D.poleSegments),
        matMetal,
    );
    pole.position.y = D.poleY;
    pole.castShadow = true;
    lamp.add(pole);

    const shade = new THREE.Mesh(
        new THREE.ConeGeometry(D.shadeRadius, D.shadeHeight, D.shadeSegments, 1, true),
        matLampSh,
    );
    shade.position.y = D.shadeY;
    shade.castShadow = true;
    lamp.add(shade);

    const bulb = new THREE.PointLight(D.bulbColor, D.bulbIntensity, D.bulbDistance);
    bulb.position.y = D.bulbY;
    bulb.castShadow = true;
    bulb.shadow.mapSize.set(D.bulbShadowMapSize, D.bulbShadowMapSize);
    bulb.shadow.radius = D.bulbShadowRadius;
    lamp.add(bulb);

    if (position) lamp.position.set(position.x, position.y || 0, position.z);
    if (rotation != null) lamp.rotation.y = rotation;

    lamp.userData.toggleType = 'light';
    lamp.userData.lightRef = bulb;

    return { group: lamp, light: bulb };
}
