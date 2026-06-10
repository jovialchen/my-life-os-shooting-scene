/**
 * 零件库统一入口 + buildRoom 构建器
 *
 * buildRoom(config) 读取房间配置，调用各工厂，组装完整的房间 Group。
 */
import * as THREE from 'three';
import { createSolidWall, createWindowWall, createDoorWall, createFloor, createCeiling } from './walls.js';
import { createSofa, createChair, createCoffeeTable, createSideTable, createBookshelf, createFloorLamp } from './furniture.js';
import { createCeilingLight } from './lights.js';
import { createRug, createWallArt } from './decoration.js';
import { createPlant, createCushion, createBook } from './smallItems.js';
import { matCushion, matFabricA, matBook1, matBook2, matBook3 } from '../materials.js';

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

        if (fDef.type === 'sofa') {
            room.add(result.sofa);
            result.cushions.forEach(c => {
                room.add(c);
                c.userData.movableType = 'small-item';
                c.userData.rotationConstraint = 'horizontal';
                smallItemList.push(c);
                allMovables.push(c);
            });
            furnitureList.push({ type: 'sofa', group: result.sofa, children: result.cushions });
            allMovables.push(result.sofa);
        } else if (fDef.type === 'sideTable') {
            room.add(result.table);
            room.add(result.book);
            result.book.userData.movableType = 'small-item';
            result.book.userData.rotationConstraint = 'any';
            furnitureList.push({ type: 'sideTable', group: result.table, children: [result.book] });
            allMovables.push(result.table);
            smallItemList.push(result.book);
            allMovables.push(result.book);
        } else if (fDef.type === 'bookshelf') {
            room.add(result.shelf);
            result.books.forEach(b => {
                room.add(b);
                b.userData.movableType = 'small-item';
                b.userData.rotationConstraint = 'any';
                smallItemList.push(b);
                allMovables.push(b);
            });
            furnitureList.push({ type: 'bookshelf', group: result.shelf, children: result.books });
            allMovables.push(result.shelf);
        } else if (fDef.type === 'floorLamp') {
            room.add(result.group);
            floorLamp = result.group;
            furnitureList.push({ type: 'floorLamp', group: result.group });
            allMovables.push(result.group);
        } else {
            room.add(result);
            furnitureList.push({ type: fDef.type, group: result });
            allMovables.push(result);
        }
    });

    // ── 4. 灯具 ──
    config.lights.forEach(lDef => {
        const factory = LIGHT_FACTORY[lDef.type];
        if (!factory) return;
        const result = factory(lDef.pos, size);
        room.add(result.group);
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

        if (dDef.type === 'rug') {
            result.userData.surface = 'floor';
        } else if (dDef.type === 'wallArt') {
            result.userData.surface = 'wall-left';
        }
        allMovables.push(result);
    });

    // ── 6. 小物品 ──
    config.smallItems.forEach(sDef => {
        let item;
        const pos = sDef.pos ? { x: sDef.pos.x, y: sDef.pos.y, z: sDef.pos.z } : undefined;

        switch (sDef.type) {
            case 'plant':
                item = createPlant({ position: pos, leafCount: sDef.leafCount });
                item.userData.rotationConstraint = 'horizontal';
                break;
            case 'cushion':
                item = createCushion({
                    position: pos,
                    rotation: sDef.rot,
                    material: resolveMaterial(sDef.material),
                });
                item.userData.rotationConstraint = 'horizontal';
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
                item.userData.rotationConstraint = 'any';
                break;
        }

        if (item) {
            room.add(item);
            smallItemList.push(item);
            allMovables.push(item);
            item.userData.movableType = 'small-item';
        }
    });

    // ── 7. 建立父子携带关系 ──
    buildParentChildRelations(config, furnitureList, smallItemList);

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


/**
 * 根据配置中的 parent 字段，建立家具-小物品的携带关系
 */
function buildParentChildRelations(config, furnitureList, smallItemList) {
    // 建立 type → furniture group 的映射
    const furnitureMap = {};
    furnitureList.forEach(f => {
        furnitureMap[f.type] = f.group;
        if (f.children) {
            f.children.forEach(c => {
                c.userData.parentGroup = f.group;
            });
            f.group.userData.children = [...(f.group.userData.children || []), ...f.children];
        }
    });

    // 根据配置中的 parent 字段绑定小物品
    config.smallItems.forEach((sDef, i) => {
        if (sDef.parent && smallItemList[i]) {
            const parentGroup = furnitureMap[sDef.parent];
            if (parentGroup) {
                smallItemList[i].userData.parentGroup = parentGroup;
                parentGroup.userData.children = parentGroup.userData.children || [];
                parentGroup.userData.children.push(smallItemList[i]);
            }
        }
    });
}
