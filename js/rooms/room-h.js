/**
 * Room H 配置文件
 *
 * 南排最右间，8×7
 * 北墙有门（连接走廊），南墙有窗（采光面），东墙实心（公寓外墙），西墙实心
 */

export const roomH = {
    id: 'room-h',
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
        // 东墙：实心（公寓外墙）
        { type: 'solid', facing: 'east' },
        // 西墙：实心
        { type: 'solid', facing: 'west' },
    ],

    furniture: [],
    lights: [
        { type: 'ceilingLight', pos: { x: 0, z: 0 } },
    ],
    decorations: [],
    smallItems: [],
};
