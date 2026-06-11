/**
 * Room E 配置文件
 *
 * 南排最左间，8×7
 * 北墙有门（连接走廊），南墙有窗（采光面），西墙实心（公寓外墙），东墙实心
 */

export const roomE = {
    id: 'room-e',
    size: { width: 8, depth: 7, height: 3.5 },

    walls: [
        // 北墙：门（连接走廊）
        {
            type: 'door',
            facing: 'north',
            door: { width: 1.2, height: 2.4, openDirection: 'left' },
        },
        // 南墙：窗
        {
            type: 'window',
            facing: 'south',
            window: { width: 5, sillHeight: 0.25, topHeight: 3.25 },
        },
        // 西墙：实心（公寓外墙）
        { type: 'solid', facing: 'west' },
        // 东墙：实心
        { type: 'solid', facing: 'east' },
    ],

    furniture: [],
    lights: [
        { type: 'ceilingLight', pos: { x: 0, z: 0 } },
    ],
    decorations: [],
    smallItems: [],
};
