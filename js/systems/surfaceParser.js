/**
 * 表面解析器：从 GLB scene 提取导航/交互数据（doc/design-surface-system.md §3）
 *
 * 分类规则：
 *   - userData.surface_walkable → 可行走面（驱动带高度的导航网格）
 *   - userData.interactable_type === 'door' → 跳过（门由 systems/doors.js 动态管理）
 *   - userData.nav_ignore → 跳过（草丛/花丛等纯视觉装饰，不进导航）
 *   - 其余 mesh → 障碍物（按净空规则从可行走格中剔除对应高度层）
 */
export function parseSurfaces(root) {
    const walkable = [];
    const obstacles = [];
    root.updateWorldMatrix(true, true);
    root.traverse((child) => {
        if (!child.isMesh) return;
        if (child.userData.interactable_type === 'door') return;
        if (child.userData.nav_ignore) return;   // 草丛/花丛：纯视觉，不进导航
        if (child.userData.surface_walkable) {
            walkable.push(child);
        } else {
            obstacles.push(child);
        }
    });
    return { walkable, obstacles };
}
