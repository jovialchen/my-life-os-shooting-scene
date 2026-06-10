/**
 * 客厅配置文件
 *
 * 定义客厅的所有元素：墙壁、家具、灯具、装饰、小物品
 * 由 buildRoom() 读取此配置来构建完整的 Three.js 场景
 */

export const livingRoom = {
    id: 'living-room',
    size: { width: 8, depth: 7, height: 3.5 },

    // ── 墙壁 ──
    walls: [
        // 南墙：大窗 + 窗帘
        {
            type: 'window',
            facing: 'south',
            window: { width: 5, sillHeight: 0.25, topHeight: 3.25 },
            curtain: { rodLength: 6.0 },
        },
        // 北墙：门
        {
            type: 'door',
            facing: 'north',
            door: { width: 1.2, height: 2.4, openDirection: 'left' },
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

    // ── 小物品（独立于家具的） ──
    // 注意：靠枕由 sofa 工厂内部创建，边桌书本由 sideTable 工厂内部创建，
    //       书架书本由 bookshelf 工厂随机生成，此处只定义独立的小物品
    smallItems: [
        // 窗台盆栽
        { type: 'plant', pos: { x: -2.9, y: 0.28, z: -3.1 } },
    ],
};
