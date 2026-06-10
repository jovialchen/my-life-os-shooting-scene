/**
 * 卧室配置工厂
 *
 * 生成各卧室的配置对象，北墙有窗（采光面），南墙有门（连接中央走廊）
 * 不含家具
 */

/**
 * 创建卧室配置
 * @param {object} opts
 * @param {string} opts.id - 房间 ID
 * @param {number} opts.width - 开间（米）
 * @param {number} opts.depth - 进深（米）
 * @param {number} opts.height - 层高（米），默认 3.5
 * @param {number} opts.windowWidth - 北窗宽度（米），默认 1.5
 * @param {string} opts.doorDirection - 门开方向，默认 'left'
 */
export function createBedroomConfig({
    id,
    width,
    depth,
    height = 3.5,
    windowWidth = 1.5,
    doorDirection = 'left',
}) {
    return {
        id,
        size: { width, depth, height },

        // ── 墙壁 ──
        walls: [
            // 北墙：窗（采光面）
            {
                type: 'window',
                facing: 'north',
                window: { width: windowWidth, sillHeight: 0.25, topHeight: 3.25 },
            },
            // 南墙：门（连接中央走廊）
            {
                type: 'door',
                facing: 'south',
                door: { width: 1.2, height: 2.4, openDirection: doorDirection },
            },
            // 东墙：实心
            { type: 'solid', facing: 'east' },
            // 西墙：实心
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
}

// ── 预定义卧室 ──

/** 卧室1：左侧第一间次卧 */
export const bedroom1 = createBedroomConfig({
    id: 'bedroom-1',
    width: 2.8,
    depth: 4,
    windowWidth: 1.5,
});

/** 卧室2：左侧第二间次卧 */
export const bedroom2 = createBedroomConfig({
    id: 'bedroom-2',
    width: 2.8,
    depth: 4,
    windowWidth: 1.5,
});

/** 卧室3：右侧次卧 */
export const bedroom3 = createBedroomConfig({
    id: 'bedroom-3',
    width: 2.5,
    depth: 4,
    windowWidth: 1.5,
});

/** 主卧：右侧主卧室 */
export const masterBedroom = createBedroomConfig({
    id: 'master-bedroom',
    width: 3.0,
    depth: 4,
    windowWidth: 2.0,
});
