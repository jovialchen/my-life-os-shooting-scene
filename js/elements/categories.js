/**
 * 类别属性注册表
 *
 * 定义每类物品的共享 userData 属性。
 * buildRoom() 创建物品后调用 applyDefaults() 统一打标签，
 * 消除散落在工厂/buildRoom/dragControls 三处的属性定义。
 */

// ── 大类默认属性 ──
export const CATEGORY_DEFAULTS = {
    furniture:    { surface: 'floor' },
    light:        { notMovable: true, toggleType: 'light' },
    decoration:   {},
    'small-item': { movableType: 'small-item' },
};

// ── 装饰子类型覆盖 ──
export const DECORATION_OVERRIDES = {
    rug:     { surface: 'floor', noCollision: true },
    wallArt: { surface: 'wall-left', crossWall: true },
};

// ── 小物品子类型覆盖 ──
export const SMALL_ITEM_OVERRIDES = {
    plant:          { rotationConstraint: 'horizontal' },
    cushion:        { rotationConstraint: 'horizontal' },
    book:           { rotationConstraint: 'any' },
    bookshelfBooks: { rotationConstraint: 'any' },
};

/**
 * 给物品的 userData 打上类别默认属性
 *
 * @param {THREE.Object3D} obj     — 目标物体
 * @param {string}         category — 'furniture' | 'light' | 'decoration' | 'small-item'
 * @param {string}         [subType] — 子类型（如 'rug'、'book'），用于查覆盖表
 */
export function applyDefaults(obj, category, subType) {
    const base = CATEGORY_DEFAULTS[category] || {};

    let overrides = {};
    if (category === 'decoration' && subType) {
        overrides = DECORATION_OVERRIDES[subType] || {};
    } else if (category === 'small-item' && subType) {
        overrides = SMALL_ITEM_OVERRIDES[subType] || {};
    }

    for (const [k, v] of Object.entries({ ...base, ...overrides })) {
        obj.userData[k] = v;
    }
}
