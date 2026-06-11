/**
 * Room F 配置文件（原客厅）
 *
 * 南排第二间，8×7
 * 北墙有门（连接走廊），南墙有窗（采光面），东墙实心，西墙实心
 */

export const livingRoom = {
    id: 'room-f',
    size: { width: 8, depth: 7, height: 3.5 },

    // ── 墙壁 ──
    walls: [
        // 北墙：门（连接走廊）
        {
            type: 'door',
            facing: 'north',
            door: { width: 1.2, height: 2.4, openDirection: 'left' },
        },
        // 南墙：大窗 + 窗帘
        {
            type: 'window',
            facing: 'south',
            window: { width: 5, sillHeight: 0.25, topHeight: 3.25 },
            curtain: { rodLength: 6.0 },
        },
        // 东墙：实心
        { type: 'solid', facing: 'east' },
        // 西墙：实心
        { type: 'solid', facing: 'west' },
    ],

    // ── 家具 ──
    furniture: [
        { type: 'sofa',        pos: { x: -1.5, z: 0.5 },  rot: Math.PI / 2 },
        { type: 'chair',       pos: { x: 1.8, z: 1.2 },   rot: -Math.PI / 4 },
        { type: 'coffeeTable', pos: { x: 0.3, z: 1.5 } },
        { type: 'sideTable',   pos: { x: -3.0, z: -1.8 } },
        { type: 'bookshelf',   pos: { x: -3.625, z: 0 },   rot: Math.PI / 2 },
        { type: 'floorLamp',   pos: { x: 2.5, z: -1.5 } },
    ],

    // ── 灯具 ──
    lights: [
        { type: 'ceilingLight', pos: { x: 0, z: 0 } },
    ],

    // ── 装饰 ──
    decorations: [
        { type: 'rug',     pos: { x: 0, z: 0.5 } },
        { type: 'wallArt', pos: { x: -3.97, y: 2.0, z: -1.0 }, rot: Math.PI / 2 },
    ],

    // ── 小物品 ──
    smallItems: [
        // 地面盆栽
        { type: 'plant', pos: { x: -2.9, y: 0, z: -3.1 } },

        // 沙发靠枕（相对于沙发局部坐标）
        { type: 'cushion', parent: 'sofa', relPos: { x: -0.7, y: 0.8, z: -0.2 }, rotZ: 0.15, material: 'cushion' },
        { type: 'cushion', parent: 'sofa', relPos: { x: 0.7, y: 0.8, z: -0.2 }, rotZ: -0.1, material: 'fabricA' },

        // 边桌书本（相对于边桌局部坐标）
        { type: 'book', parent: 'sideTable', relPos: { x: 0.05, y: 0.7, z: 0 }, rot: 0.3, width: 0.15, height: 0.06, depth: 0.2, material: 'book1' },

        // 书架书本（随机生成，每层 3~5 本）
        { type: 'bookshelfBooks', parent: 'bookshelf' },
    ],
};
