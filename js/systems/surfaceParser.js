/**
 * 表面解析器：从 GLB scene 提取导航/交互数据（doc/design-surface-system.md §3）
 *
 * 分类规则（标记可来自自身或祖先节点——多材质 mesh 在 GLB 里会拆成
 * Group + 子 mesh，extras 落在 Group 上）：
 *   - userData.surface_walkable → 可行走面（驱动带高度的导航网格）
 *   - userData.interactable_type === 'door' → 跳过（门由 systems/doors.js 动态管理）
 *   - userData.nav_ignore → 跳过（草丛/花丛/雪人等纯视觉装饰，不进导航）
 *   - 其余 mesh → 障碍物（按净空规则从可行走格中剔除对应高度层）
 */
export function parseSurfaces(root) {
    const walkable = [];
    const obstacles = [];
    root.updateWorldMatrix(true, true);
    root.traverse((child) => {
        if (!child.isMesh) return;
        if (hasFlag(child, 'interactable_type', 'door')) return;
        if (hasFlag(child, 'nav_ignore')) return;
        if (hasFlag(child, 'surface_walkable')) {
            walkable.push(child);
        } else {
            obstacles.push(child);
        }
    });
    return { walkable, obstacles };
}

/** 沿父链向上找 userData 标记（val 省略时只需真值） */
function hasFlag(obj, key, val) {
    for (let o = obj; o; o = o.parent) {
        const v = o.userData?.[key];
        if (val !== undefined ? v === val : Boolean(v)) return true;
    }
    return false;
}
