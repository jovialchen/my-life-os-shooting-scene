/**
 * 季节专属物体工厂
 *
 * 果子（秋）、蘑菇（秋）、雪人（冬）、树上雪团（冬）
 * 预创建后按季节控制 visible
 */
import * as THREE from 'three';

// ── 材质 ─────────────────────────────────────────────
const matFruit1 = new THREE.MeshStandardMaterial({ color: 0xcc3333, roughness: 0.8 });  // 红果
const matFruit2 = new THREE.MeshStandardMaterial({ color: 0xdd8833, roughness: 0.8 });  // 橙果
const matMushroomCap = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.9 }); // 棕菌盖
const matMushroomSpot = new THREE.MeshStandardMaterial({ color: 0xcc4444, roughness: 0.85 }); // 红斑点
const matMushroomStem = new THREE.MeshStandardMaterial({ color: 0xf0e8d0, roughness: 0.9 }); // 白菌柄
const matSnow = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.95 });   // 雪白
const matSnowmanEye = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.3 }); // 黑眼
const matSnowmanNose = new THREE.MeshStandardMaterial({ color: 0xff8800, roughness: 0.8 }); // 橙鼻


// ============================================================
//  果子（秋天挂在树上）
// ============================================================

/**
 * 在每棵树附近生成几个小果子
 * @param {Array<{x: number, z: number}>} treePositions
 * @returns {THREE.Group}
 */
function createFruits(treePositions) {
    const group = new THREE.Group();
    group.name = 'fruits';

    for (const tree of treePositions) {
        const count = 2 + Math.floor(Math.random() * 3); // 2-4 个果子
        for (let i = 0; i < count; i++) {
            const mat = Math.random() > 0.5 ? matFruit1 : matFruit2;
            const fruit = new THREE.Mesh(
                new THREE.SphereGeometry(0.06, 6, 5),
                mat,
            );
            // 随机挂在树冠高度附近
            fruit.position.set(
                tree.x + (Math.random() - 0.5) * 1.5,
                2.0 + Math.random() * 2.0,
                tree.z + (Math.random() - 0.5) * 1.5,
            );
            fruit.castShadow = true;
            fruit.userData.isOccluder = true;
            group.add(fruit);
        }
    }

    return group;
}


// ============================================================
//  蘑菇（秋天长在草地上）
// ============================================================

/**
 * 在建筑四周草地上生成蘑菇
 * @param {object} grassInfo — { centerX, centerZ, radius }
 * @returns {THREE.Group}
 */
function createMushrooms(grassInfo) {
    const group = new THREE.Group();
    group.name = 'mushrooms';

    const bldgMinX = -16.5;
    const bldgMaxX =  16.5;
    const bldgMinZ = -4.0;
    const bldgMaxZ =  14.0;

    // 蘑菇位置：建筑四周，避开建筑
    const positions = [
        { x: -10, z: -6 }, { x: -3, z: -7 }, { x: 6, z: -6 }, { x: 13, z: -5 },
        { x: -10, z: 15 }, { x: -2, z: 16 }, { x: 5, z: 15 }, { x: 12, z: 16 },
        { x: -19, z: 1 }, { x: -19, z: 8 }, { x: 19, z: 2 }, { x: 19, z: 9 },
        { x: -5, z: -2 }, { x: 7, z: -2 }, { x: -5, z: 12 }, { x: 7, z: 12 },
        { x: -14, z: -3 }, { x: 14, z: -3 },
    ];

    for (const pos of positions) {
        // 确保在草地圆内
        const dx = pos.x - grassInfo.centerX;
        const dz = pos.z - grassInfo.centerZ;
        if (dx * dx + dz * dz > (grassInfo.radius - 2) * (grassInfo.radius - 2)) continue;

        // 确保不在建筑范围内
        if (pos.x > bldgMinX - 1 && pos.x < bldgMaxX + 1 &&
            pos.z > bldgMinZ - 1 && pos.z < bldgMaxZ + 1) continue;

        const s = 0.7 + Math.random() * 0.6;
        const mushroom = new THREE.Group();

        // 菌柄
        const stem = new THREE.Mesh(
            new THREE.CylinderGeometry(0.02 * s, 0.025 * s, 0.1 * s, 5),
            matMushroomStem,
        );
        stem.position.y = 0.05 * s;
        stem.castShadow = true;
        mushroom.add(stem);

        // 菌盖
        const cap = new THREE.Mesh(
            new THREE.SphereGeometry(0.06 * s, 7, 5),
            matMushroomCap,
        );
        cap.position.y = 0.1 * s;
        cap.scale.set(1, 0.5, 1);
        cap.castShadow = true;
        mushroom.add(cap);

        // 红色斑点
        const spotCount = 2 + Math.floor(Math.random() * 3);
        for (let j = 0; j < spotCount; j++) {
            const spot = new THREE.Mesh(
                new THREE.SphereGeometry(0.012 * s, 4, 3),
                matMushroomSpot,
            );
            const a = Math.random() * Math.PI * 2;
            spot.position.set(
                Math.cos(a) * 0.04 * s,
                0.11 * s,
                Math.sin(a) * 0.04 * s,
            );
            mushroom.add(spot);
        }

        mushroom.position.set(pos.x, 0, pos.z);
        mushroom.rotation.y = Math.random() * Math.PI * 2;
        group.add(mushroom);
    }

    return group;
}


// ============================================================
//  雪人（冬天放在花园西侧）
// ============================================================

/**
 * 创建一个雪人
 * @param {THREE.Vector3} position
 * @returns {THREE.Group}
 */
function createSnowman(position) {
    const g = new THREE.Group();
    g.name = 'snowman';

    // 底球
    const bottom = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), matSnow);
    bottom.position.y = 0.5;
    bottom.castShadow = true;
    g.add(bottom);

    // 中球
    const middle = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), matSnow);
    middle.position.y = 1.15;
    middle.castShadow = true;
    g.add(middle);

    // 头球
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), matSnow);
    head.position.y = 1.65;
    head.castShadow = true;
    g.add(head);

    // 眼睛
    for (const side of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 4, 3), matSnowmanEye);
        eye.position.set(side * 0.08, 1.72, 0.2);
        g.add(eye);
    }

    // 胡萝卜鼻子
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.15, 4), matSnowmanNose);
    nose.position.set(0, 1.65, 0.25);
    nose.rotation.x = Math.PI / 2;
    g.add(nose);

    g.position.copy(position);
    return g;
}


// ============================================================
//  树上雪团（冬天覆盖在树冠上）
// ============================================================

/**
 * 在每棵树冠上生成白色雪团
 * @param {Array<{x: number, z: number}>} treePositions
 * @returns {THREE.Group}
 */
function createTreeSnow(treePositions) {
    const group = new THREE.Group();
    group.name = 'treeSnow';

    for (const tree of treePositions) {
        // 每棵树 2-3 个白球
        const count = 2 + Math.floor(Math.random() * 2);
        for (let i = 0; i < count; i++) {
            const r = 0.3 + Math.random() * 0.4;
            const snow = new THREE.Mesh(
                new THREE.SphereGeometry(r, 7, 5),
                matSnow,
            );
            snow.position.set(
                tree.x + (Math.random() - 0.5) * 1.2,
                3.0 + Math.random() * 2.0,
                tree.z + (Math.random() - 0.5) * 1.2,
            );
            snow.scale.set(1, 0.6, 1); // 压扁一点像积雪
            snow.castShadow = true;
            snow.userData.isOccluder = true;
            group.add(snow);
        }
    }

    return group;
}


// ============================================================
//  总入口：创建所有季节物体
// ============================================================

/**
 * 创建所有季节专属物体
 * @param {object} grassInfo — { centerX, centerZ, radius }
 * @param {Array<{x: number, z: number}>} treePositions
 * @returns {THREE.Group}
 */
export function createSeasonalObjects(grassInfo, treePositions) {
    const group = new THREE.Group();
    group.name = 'seasonalObjects';

    // 果子（秋）
    const fruits = createFruits(treePositions);
    fruits.visible = false;
    group.add(fruits);

    // 蘑菇（秋）
    const mushrooms = createMushrooms(grassInfo);
    mushrooms.visible = false;
    group.add(mushrooms);

    // 雪人（冬）
    const snowman = createSnowman(new THREE.Vector3(-10, 0, 5));
    snowman.visible = false;
    group.add(snowman);

    // 树上雪团（冬）
    const treeSnow = createTreeSnow(treePositions);
    treeSnow.visible = false;
    group.add(treeSnow);

    return group;
}
