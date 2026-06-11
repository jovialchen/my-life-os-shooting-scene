/**
 * 北排房间配置工厂
 *
 * 4 间统一 8×7，北墙有窗（采光面），南墙有门（连接走廊）
 * 每间都建齐 4 面墙（相邻房间的共用墙会重叠，但不透明无视觉问题）
 */

/**
 * 创建北排房间配置
 * @param {object} opts
 * @param {string} opts.id - 房间 ID
 */
export function createNorthRoomConfig({ id }) {
    return {
        id,
        size: { width: 8, depth: 7, height: 3.5 },
        walls: [
            // 北墙：窗（采光面）
            {
                type: 'window',
                facing: 'north',
                window: { width: 5, sillHeight: 0.25, topHeight: 3.25 },
            },
            // 南墙：门（连接走廊）
            {
                type: 'door',
                facing: 'south',
                door: { width: 1.2, height: 2.4, openDirection: 'left' },
            },
            // 东墙：实心墙
            { type: 'solid', facing: 'east' },
            // 西墙：实心墙
            { type: 'solid', facing: 'west' },
        ],
        furniture: [],
        lights: [
            { type: 'ceilingLight', pos: { x: 0, z: 0 } },
        ],
        decorations: [],
        smallItems: [],
    };
}

// ── 北排 4 间 ──

/** room-a：北排左一（最左，西墙是公寓外墙） */
export const roomA = createNorthRoomConfig({ id: 'room-a' });

/** room-b：北排左二 */
export const roomB = createNorthRoomConfig({ id: 'room-b' });

/** room-c：北排右二 */
export const roomC = createNorthRoomConfig({ id: 'room-c' });

/** room-d：北排右一（最右，东墙是公寓外墙） */
export const roomD = createNorthRoomConfig({ id: 'room-d' });

// ── 向后兼容旧名 ──
export const bedroom1 = roomA;
export const bedroom2 = roomB;
export const bedroom3 = roomC;
export const masterBedroom = roomD;
