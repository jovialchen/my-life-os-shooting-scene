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
//  果子（秋天挂在树冠上）
// ============================================================

/**
 * 遍历树木，在树冠 mesh 附近挂果子
 * @param {THREE.Group} gardenTreesGroup
 * @returns {THREE.Group}
 */
function createFruits(gardenTreesGroup) {
    const group = new THREE.Group();
    group.name = 'fruits';

    if (!gardenTreesGroup) return group;

    for (const tree of gardenTreesGroup.children) {
        const canopyMeshes = tree.userData.canopyMeshes || [];
        if (canopyMeshes.length === 0) continue;

        // 每棵树挂 3-5 个果子
        const count = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < count; i++) {
            // 随机选一个树冠 mesh
            const canopy = canopyMeshes[Math.floor(Math.random() * canopyMeshes.length)];
            const worldPos = new THREE.Vector3();
            canopy.getWorldPosition(worldPos);
            const worldScale = new THREE.Vector3();
            canopy.getWorldScale(worldScale);

            const mat = Math.random() > 0.5 ? matFruit1 : matFruit2;
            const fruit = new THREE.Mesh(
                new THREE.SphereGeometry(0.2, 6, 5),
                mat,
            );

            // 计算树冠表面位置
            // 随机方向（水平角度）
            const theta = Math.random() * Math.PI * 2;
            // 向下偏一点（果子长在树冠下半球表面）
            const phi = Math.random() * Math.PI * 0.4 + Math.PI * 0.3; // 54°~126°

            // 根据树冠类型估算表面半径
            let surfaceR;
            if (canopy.geometry.type === 'SphereGeometry') {
                surfaceR = canopy.geometry.parameters.radius * Math.max(worldScale.x, worldScale.z);
            } else if (canopy.geometry.type === 'ConeGeometry') {
                surfaceR = canopy.geometry.parameters.radius * Math.max(worldScale.x, worldScale.z) * 0.7;
            } else {
                surfaceR = Math.max(worldScale.x, worldScale.z) * 0.8;
            }

            // 放在树冠外表面上
            fruit.position.set(
                worldPos.x + Math.sin(phi) * Math.cos(theta) * surfaceR,
                worldPos.y + Math.cos(phi) * surfaceR * 0.6, // 稍微压扁Y方向
                worldPos.z + Math.sin(phi) * Math.sin(theta) * surfaceR,
            );
            fruit.castShadow = true;
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

    // 底球（大）
    const bottom = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 6), matSnow);
    bottom.position.y = 0.8;
    bottom.castShadow = true;
    g.add(bottom);

    // 中球
    const middle = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), matSnow);
    middle.position.y = 1.85;
    middle.castShadow = true;
    g.add(middle);

    // 头球
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), matSnow);
    head.position.y = 2.65;
    head.castShadow = true;
    g.add(head);

    // 眼睛（大号黑色）
    for (const side of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 5, 4), matSnowmanEye);
        eye.position.set(side * 0.14, 2.78, 0.32);
        g.add(eye);
    }

    // 胡萝卜鼻子（大号橙色）
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.3, 5), matSnowmanNose);
    nose.position.set(0, 2.65, 0.38);
    nose.rotation.x = Math.PI / 2;
    g.add(nose);

    // 黑色礼帽
    const matHat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 });
    // 帽檐
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.06, 8), matHat);
    brim.position.y = 3.0;
    brim.castShadow = true;
    g.add(brim);
    // 帽筒
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.45, 8), matHat);
    crown.position.y = 3.25;
    crown.castShadow = true;
    g.add(crown);

    // 红色围巾
    const matScarf = new THREE.MeshStandardMaterial({ color: 0xcc2222, roughness: 0.85 });
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 5, 12), matScarf);
    scarf.position.set(0, 2.3, 0);
    scarf.rotation.x = Math.PI / 2;
    g.add(scarf);

    g.position.copy(position);
    return g;
}


// ============================================================
//  树上雪团（冬天，匹配树形）
// ============================================================

/**
 * 根据树木实际形状生成雪团
 * - 落叶木/樱花：白色球冠（和树冠同位置同大小）
 * - 松树：绿色锥体上方叠加白色小锥体
 * @param {THREE.Group} gardenTreesGroup
 * @returns {THREE.Group}
 */
function createTreeSnow(gardenTreesGroup) {
    const group = new THREE.Group();
    group.name = 'treeSnow';

    if (!gardenTreesGroup) return group;

    for (const tree of gardenTreesGroup.children) {
        const type = tree.userData.treeType;
        const canopyMeshes = tree.userData.canopyMeshes || [];

        if (type === 'deciduous' || type === 'cherry') {
            // 落叶木 / 樱花：在每个树冠 mesh 上生成同形状白色版本
            for (const child of canopyMeshes) {
                const worldPos = new THREE.Vector3();
                child.getWorldPosition(worldPos);
                const worldQuat = new THREE.Quaternion();
                child.getWorldQuaternion(worldQuat);
                const worldScale = new THREE.Vector3();
                child.getWorldScale(worldScale);

                const snowGeo = child.geometry.clone();
                const snow = new THREE.Mesh(snowGeo, matSnow);
                snow.position.copy(worldPos);
                snow.quaternion.copy(worldQuat);
                snow.scale.copy(worldScale).multiplyScalar(0.92);
                snow.position.y += 0.05;
                snow.castShadow = true;
                group.add(snow);
            }
        } else if (type === 'pine') {
            // 松树：在每个绿色锥体上方叠加一个白色小锥体
            for (const child of canopyMeshes) {
                const worldPos = new THREE.Vector3();
                child.getWorldPosition(worldPos);
                const worldQuat = new THREE.Quaternion();
                child.getWorldQuaternion(worldQuat);
                const worldScale = new THREE.Vector3();
                child.getWorldScale(worldScale);

                const params = child.geometry.parameters;
                const snowCone = new THREE.Mesh(
                    new THREE.ConeGeometry(params.radiusTop * 0.85, params.height * 0.6, params.radialSegments),
                    matSnow,
                );
                snowCone.position.copy(worldPos);
                snowCone.position.y += params.height * 0.25 * worldScale.y;
                snowCone.quaternion.copy(worldQuat);
                snowCone.scale.copy(worldScale);
                snowCone.castShadow = true;
                group.add(snowCone);
            }
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
 * @param {THREE.Group} gardenTreesGroup — 花园树木 group
 * @returns {THREE.Group}
 */
export function createSeasonalObjects(grassInfo, gardenTreesGroup) {
    const group = new THREE.Group();
    group.name = 'seasonalObjects';

    // 果子（秋）— 挂在树冠上
    const fruits = createFruits(gardenTreesGroup);
    fruits.visible = false;
    group.add(fruits);

    // 蘑菇（秋）— 长在草地上
    const mushrooms = createMushrooms(grassInfo);
    mushrooms.visible = false;
    group.add(mushrooms);

    // 雪人（冬）— 放在建筑外西侧草地（x=-19 避开建筑）
    const snowman = createSnowman(new THREE.Vector3(-19, 0, 5));
    snowman.visible = false;
    group.add(snowman);

    // 树上雪团（冬）— 匹配树形
    const treeSnow = createTreeSnow(gardenTreesGroup);
    treeSnow.visible = false;
    group.add(treeSnow);

    return group;
}
