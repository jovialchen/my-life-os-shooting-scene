/**
 * 北排房间配置工厂
 *
 * 4 间统一 8×7，北墙有窗（采光面），南墙有门（连接走廊）
 * 相邻房间共享一堵实心墙，由其中一侧负责建造
 */

/**
 * 创建北排房间配置
 * @param {object} opts
 * @param {string} opts.id - 房间 ID
 * @param {boolean} [opts.skipEastWall=false] - 不建东墙（由右侧邻居建西墙）
 * @param {boolean} [opts.skipWestWall=false] - 不建西墙（由左侧邻居建东墙）
 */
export function createNorthRoomConfig({
    id,
    skipEastWall = false,
    skipWestWall = false,
}) {
    const walls = [
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
    ];

    if (!skipEastWall) {
        walls.push({ type: 'solid', facing: 'east' });
    }
    if (!skipWestWall) {
        walls.push({ type: 'solid', facing: 'west' });
    }

    return {
        id,
        size: { width: 8, depth: 7, height: 3.5 },
        walls,
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
export const roomA = createNorthRoomConfig({
    id: 'room-a',
    skipWestWall: false,
    skipEastWall: false,   // 东墙由 room-a 建，room-b 不建西墙
});

/** room-b：北排左二 */
export const roomB = createNorthRoomConfig({
    id: 'room-b',
    skipWestWall: true,   // 西墙由 room-a 建
    skipEastWall: false,   // 东墙由 room-b 建，room-c 不建西墙
});

/** room-c：北排右二 */
export const roomC = createNorthRoomConfig({
    id: 'room-c',
    skipWestWall: true,   // 西墙由 room-b 建
    skipEastWall: false,   // 东墙由 room-c 建，room-d 不建西墙
});

/** room-d：北排右一（最右，东墙是公寓外墙） */
export const roomD = createNorthRoomConfig({
    id: 'room-d',
    skipWestWall: true,   // 西墙由 room-c 建
    skipEastWall: false,
});

// ── 向后兼容旧名 ──
export const bedroom1 = roomA;
export const bedroom2 = roomB;
export const bedroom3 = roomC;
export const masterBedroom = roomD;
