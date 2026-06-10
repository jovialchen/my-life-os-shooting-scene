/**
 * 中央走廊配置文件
 *
 * 连接客厅与卧室的过渡空间，无家具
 * 南北都不建墙 —— 形成通道，连接客厅和卧室
 */

export const centralHall = {
    id: 'central-hall',
    size: { width: 3, depth: 3, height: 3.5 },

    // ── 墙壁 ──
    walls: [
        // 只建东西墙，南北开口
        { type: 'solid', facing: 'east' },
        { type: 'solid', facing: 'west' },
    ],

    // ── 家具（无）──
    furniture: [],

    // ── 灯具 ──
    lights: [
        { type: 'ceilingLight', pos: { x: 0, z: 0 } },
    ],

    // ── 装饰（无）──
    decorations: [],

    // ── 小物品（无）──
    smallItems: [],
};
