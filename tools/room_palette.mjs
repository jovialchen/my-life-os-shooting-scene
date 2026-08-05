/** 统一色板（plan-0805 阶段 3.2）：房间生成器共用的结构色
 *
 * 墙/地/顶/门框/窗景/吊灯全项目一致（暖白 + 暖木的手绘基调）；
 * 各房间的特色色（床品/沙发/柜体等 accents）仍在各自 spec.mats 里，
 * 家具布置后续由用户调整，这里只管结构色统一。
 *
 * 用法: import { PALETTE, BASE_MATS } from './room_palette.mjs';
 */
export const PALETTE = {
    wall: '#EDE4D3',        // 暖白（墙/天花板默认）
    floorWood: '#C9A97C',   // 暖木地板（卧室/学习室/阁楼/客厅）
    floorTile: '#B7C4BF',   // 灰绿地砖（厨房/卫生间）
    frame: '#6E4B32',       // 门窗框深木
    door: '#8A5A3B',        // 门板木
    windowView: '#A8D8EA',  // 窗景片（时间系统联动变色）
    lamp: '#FFE9B8',        // 吊灯（发光）
};

/** make_rooms.mjs 的 BASE_MATS（结构色取自色板） */
export const BASE_MATS = {
    MAT_frame: PALETTE.frame,
    MAT_door: PALETTE.door,
    MAT_window_view: PALETTE.windowView,
    MAT_lamp: PALETTE.lamp,
};
