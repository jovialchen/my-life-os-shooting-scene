/**
 * 零件库统一入口 + buildRoom 构建器
 *
 * buildRoom(config) 读取房间配置，调用各工厂，组装完整的房间 Group。
 */
import * as THREE from 'three';
import { createSolidWall, createWindowWall, createDoorWall, createFloor, createCeiling } from './walls.js';
import { createSofa, createChair, createCoffeeTable, createSideTable, createBookshelf, createFloorLamp, BOOKSHELF } from './furniture.js';
import { createCeilingLight } from './lights.js';
import { createRug, createWallArt } from './decoration.js';
import { createPlant, createCushion, createBook } from './smallItems.js';
import { matCushion, matFabricA, matBook1, matBook2, matBook3 } from '../materials.js';
import { applyDefaults } from './categories.js';

// ── 材质字符串映射 ──
const MATERIAL_MAP = {
    cushion: matCushion,
    fabricA: matFabricA,
    book1: matBook1,
    book2: matBook2,
    book3: matBook3,
};

function resolveMaterial(mat) {
    if (!mat) return undefined;
    if (typeof mat === 'string') return MATERIAL_MAP[mat] || matBook1;
    return mat; // 已经是 THREE.Material
}


// ── facing → 墙壁位置/旋转 映射 ──
function computeWallTransform(facing, size) {
    const { width, depth } = size;
    const halfW = width / 2;
    const halfD = depth / 2;
    // 墙厚度由 wall 工厂内部处理，这里只算内表面位置
    switch (facing) {
        case 'south': return { pos: { x: 0, y: 0, z: -halfD }, rotY: 0 };
        case 'north': return { pos: { x: 0, y: 0, z: halfD },  rotY: Math.PI };
        case 'east':  return { pos: { x: -halfW, y: 0, z: 0 }, rotY: Math.PI / 2 };
        case 'west':  return { pos: { x: halfW, y: 0, z: 0 },  rotY: -Math.PI / 2 };
        default:      return { pos: { x: 0, y: 0, z: 0 },      rotY: 0 };
    }
}

// ── 根据 facing 计算墙的宽度（沿墙方向的跨度）──
function wallWidthForFacing(facing, size) {
    switch (facing) {
        case 'south':
        case 'north': return size.width;
        case 'east':
        case 'west':  return size.depth;
        default:      return size.width;
    }
}


// ── 工厂映射表 ──
const FURNITURE_FACTORY = {
    sofa:        (opts) => createSofa(opts),
    chair:       (opts) => createChair(opts),
    coffeeTable: (opts) => createCoffeeTable(opts),
    sideTable:   (opts) => createSideTable(opts),
    bookshelf:   (opts) => createBookshelf(opts),
    floorLamp:   (opts) => createFloorLamp(opts),
};

const LIGHT_FACTORY = {
    ceilingLight: (opts, size) => createCeilingLight({ ...opts, roomHeight: size.height }),
};

const DECORATION_FACTORY = {
    rug:     (opts) => createRug(opts),
    wallArt: (opts) => createWallArt(opts),
};


/**
 * 从配置对象构建完整房间
 *
 * @param {object} config - 房间配置
 * @returns {{
 *   group: THREE.Group,
 *   door: THREE.Group|null,
 *   curtains: THREE.Group|null,
 *   ceilingLight: THREE.Group|null,
 *   floorLamp: THREE.Group|null,
 *   furniture: object[],
 *   smallItems: THREE.Group[],
 *   allMovables: THREE.Object3D[],
 * }}
 */
export function buildRoom(config) {
    const room = new THREE.Group();
    const { size } = config;

    let door = null;
    let curtains = null;
    let ceilingLight = null;
    let floorLamp = null;
    const furnitureList = [];
    const smallItemList = [];
    const allMovables = [];

    // ── 1. 建墙壁 ──
    config.walls.forEach(wallDef => {
        const wallW = wallWidthForFacing(wallDef.facing, size);
        let wall;

        switch (wallDef.type) {
            case 'solid':
                wall = createSolidWall({ width: wallW, height: size.height, thickness: 0.12 });
                break;
            case 'window':
                wall = createWindowWall({
                    width: wallW,
                    height: size.height,
                    thickness: 0.12,
                    window: wallDef.window,
                    curtain: wallDef.curtain,
                });
                if (wall.userData.curtains) curtains = wall.userData.curtains;
                break;
            case 'door':
                wall = createDoorWall({
                    width: wallW,
                    height: size.height,
                    thickness: 0.12,
                    door: wallDef.door,
                });
                door = wall;
                break;
        }

        if (wall) {
            const transform = computeWallTransform(wallDef.facing, size);
            wall.position.set(transform.pos.x, transform.pos.y, transform.pos.z);
            wall.rotation.y = transform.rotY;
            room.add(wall);
        }
    });

    // ── 2. 地板 + 天花板 ──
    room.add(createFloor({ width: size.width, depth: size.depth }));
    room.add(createCeiling({ width: size.width, depth: size.depth, height: size.height }));

    // ── 3. 家具 ──
    config.furniture.forEach(fDef => {
        const factory = FURNITURE_FACTORY[fDef.type];
        if (!factory) return;

        const result = factory({
            position: { x: fDef.pos.x, y: fDef.pos.y || 0, z: fDef.pos.z },
            rotation: fDef.rot,
        });

        if (fDef.type === 'floorLamp') {
            room.add(result.group);
            floorLamp = result.group;
            furnitureList.push({ type: 'floorLamp', group: result.group });
            allMovables.push(result.group);
            applyDefaults(result.group, 'furniture');
        } else {
            room.add(result);
            furnitureList.push({ type: fDef.type, group: result });
            allMovables.push(result);
            applyDefaults(result, 'furniture');
        }
    });

    // ── 4. 灯具 ──
    config.lights.forEach(lDef => {
        const factory = LIGHT_FACTORY[lDef.type];
        if (!factory) return;
        const result = factory(lDef.pos, size);
        room.add(result.group);
        applyDefaults(result.group, 'light');
        if (lDef.type === 'ceilingLight') {
            ceilingLight = result.group;
        }
    });

    // ── 5. 装饰 ──
    config.decorations.forEach(dDef => {
        const factory = DECORATION_FACTORY[dDef.type];
        if (!factory) return;
        const result = factory({
            position: dDef.pos,
            rotation: dDef.rot,
            width: dDef.width,
            depth: dDef.depth,
        });
        room.add(result);
        applyDefaults(result, 'decoration', dDef.type);
        allMovables.push(result);
    });

    // ── 6. 小物品 ──
    // 构建 type → furniture group 映射，用于 relPos 世界坐标转换
    const furnitureGroupMap = {};
    furnitureList.forEach(f => { furnitureGroupMap[f.type] = f.group; });

    config.smallItems.forEach(sDef => {
        // 计算世界坐标：有 relPos 时通过父家具 quaternion 旋转 + position 偏移
        let pos;
        if (sDef.relPos && sDef.parent) {
            const parentGroup = furnitureGroupMap[sDef.parent];
            if (parentGroup) {
                const local = new THREE.Vector3(sDef.relPos.x, sDef.relPos.y, sDef.relPos.z);
                local.applyQuaternion(parentGroup.quaternion).add(parentGroup.position);
                pos = { x: local.x, y: local.y, z: local.z };
            }
        } else if (sDef.pos) {
            pos = { x: sDef.pos.x, y: sDef.pos.y, z: sDef.pos.z };
        }

        // 旋转：relPos 场景下继承父家具 Y 轴旋转 + 自身 rotZ
        let item;

        switch (sDef.type) {
            case 'plant':
                item = createPlant({ position: pos, leafCount: sDef.leafCount });
                break;
            case 'cushion':
                item = createCushion({
                    position: pos,
                    material: resolveMaterial(sDef.material),
                });
                if (sDef.rotZ != null) item.rotation.z = sDef.rotZ;
                if (sDef.parent && furnitureGroupMap[sDef.parent]) {
                    item.rotation.y = furnitureGroupMap[sDef.parent].rotation.y;
                }
                break;
            case 'book':
                item = createBook({
                    position: pos,
                    rotation: sDef.rot,
                    state: sDef.state,
                    width: sDef.width,
                    height: sDef.height,
                    depth: sDef.depth,
                    material: resolveMaterial(sDef.material),
                });
                break;
            case 'bookshelfBooks': {
                const parentGroup = furnitureGroupMap[sDef.parent];
                if (!parentGroup) break;
                const D = BOOKSHELF;
                const pPos = parentGroup.position;
                const bookMats = [matBook1, matBook2, matBook3];
                for (let row = 0; row < D.shelfCount; row++) {
                    const y = row * (D.height / D.shelfCount) + D.plankThick + D.bookYOffset;
                    const count = D.bookMinCount + Math.floor(Math.random() * D.bookRandomCount);
                    let localX = -D.width / 2 + D.bookStartX;
                    for (let b = 0; b < count; b++) {
                        const bw = D.bookMinWidth + Math.random() * D.bookRandomWidth;
                        const bh = D.bookMinHeight + Math.random() * D.bookRandomHeight;
                        const local = new THREE.Vector3(0, y + bh / 2, -(localX + bw / 2));
                        local.applyQuaternion(parentGroup.quaternion).add(pPos);
                        const book = createBook({
                            position: { x: local.x, y: local.y, z: local.z },
                            rotationX: Math.PI / 2,
                            width: D.bookDepth, height: bw, depth: bh,
                            material: bookMats[b % 3],
                            state: 'standing',
                        });
                        room.add(book);
                        smallItemList.push(book);
                        allMovables.push(book);
                        applyDefaults(book, 'small-item', 'bookshelfBooks');
                        book.userData.parentGroup = parentGroup;
                        parentGroup.userData.children = parentGroup.userData.children || [];
                        parentGroup.userData.children.push(book);
                        localX += bw + D.bookGap;
                    }
                }
                break;
            }
        }

        if (item) {
            room.add(item);
            smallItemList.push(item);
            allMovables.push(item);
            applyDefaults(item, 'small-item', sDef.type);
            // 预计算 itemBottomOffset（group 原点到包围盒底部的距离）
            // 避免第一次拖拽时偏移为 0 导致盆栽等物体悬空
            item.updateMatrixWorld(true);
            const initBox = new THREE.Box3().setFromObject(item);
            item.userData.itemBottomOffset = item.position.y - initBox.min.y;
            // 有 parent 字段时直接绑定携带关系
            if (sDef.parent) {
                const parentGroup = furnitureGroupMap[sDef.parent];
                if (parentGroup) {
                    item.userData.parentGroup = parentGroup;
                    parentGroup.userData.children = parentGroup.userData.children || [];
                    parentGroup.userData.children.push(item);
                }
            }
        }
    });

    return {
        group: room,
        door,
        curtains,
        ceilingLight,
        floorLamp,
        furniture: furnitureList,
        smallItems: smallItemList,
        allMovables,
    };
}

