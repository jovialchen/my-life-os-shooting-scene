/**
 * 拖拽控制器：点击选中物体，沿所在平面拖拽移动
 * - 地面物体（floor）：沿 y=0 平面移动（x, z）
 * - 墙面物体（wall-*）：沿对应墙面移动（y + 墙面水平方向）
 * - crossWall 物体：沿墙面移动，到角落可切换到相邻墙面
 * - 小物品（small-item）：在当前高度水平移动，松开时吸附到最近表面
 * - 旋转：选中物体后 Q/E 水平旋转45°，小物品 R 垂直翻转（受 rotationConstraint 限制）
 * - 父子携带：拖拽父物体时子物体跟随移动，单独拖拽子物体可从父物体上分离
 *
 * 通过 obj.userData 标记：
 *   .surface           — 'floor' | 'wall-left' | 'wall-right' | 'wall-back' | 'wall-front'
 *   .crossWall         — true 表示可在墙面间切换
 *   .movableType       — 'small-item' 表示小物品
 *   .surfaceHeights    — [number] 小物品的子 mesh 底部到中心的偏移（用于吸附）
 *   .rotationConstraint — 'any'（水平+垂直）| 'horizontal'（仅水平）
 *   .children          — [THREE.Group] 父物体携带的子物体列表
 *   .parentGroup       — THREE.Group 子物体所属的父物体
 */
import * as THREE from 'three';
import { ROOM_HEIGHT, ROOM_HALF_W, ROOM_HALF_D } from '../config.js';

// ── 小物品吸附检测参数 ────────────────────────────────
const SNAP_RAY_Y_OFFSET = 1;   // raycast 起点在物体上方的偏移
const SNAP_SURFACE_TOLERANCE = 0.1; // 表面必须在物体下方 + 此容差内

// ── 拖拽吸附平面 ──────────────────────────────────────
const PLANES = {
    'floor':      new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
    'wall-left':  new THREE.Plane(new THREE.Vector3(1, 0, 0), ROOM_HALF_W),
    'wall-right': new THREE.Plane(new THREE.Vector3(-1, 0, 0), ROOM_HALF_W),
    'wall-back':  new THREE.Plane(new THREE.Vector3(0, 0, 1), ROOM_HALF_D),
    'wall-front': new THREE.Plane(new THREE.Vector3(0, 0, -1), ROOM_HALF_D),
};

export function createDragControls(movables, camera, renderer, orbitControls, scene, options = {}) {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const intersectPoint = new THREE.Vector3();

    let selected = null;
    let activePlane = null;
    let offset = new THREE.Vector3();
    let isDragging = false;

    // ── 父子携带：缓存子物体相对偏移 ──
    let childOffsets = null; // [{ child, offset: Vector3 }]

    const meshToGroup = new Map();
    function buildPickMap() {
        meshToGroup.clear();
        for (const group of movables) {
            group.traverse(child => {
                if (child.isMesh) meshToGroup.set(child, group);
            });
        }
    }
    buildPickMap();

    // ── 工具函数 ──

    function getMouseNDC(event) {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }

    function raycastToPlane(event, plane) {
        getMouseNDC(event);
        raycaster.setFromCamera(mouse, camera);
        raycaster.ray.intersectPlane(plane, intersectPoint);
        return intersectPoint;
    }

    function getPlaneForObject(obj) {
        const surface = obj.userData.surface || 'floor';
        return PLANES[surface] || PLANES['floor'];
    }

    function findMovableUnderMouse(event) {
        getMouseNDC(event);
        raycaster.setFromCamera(mouse, camera);
        const meshes = Array.from(meshToGroup.keys());
        const hits = raycaster.intersectObjects(meshes, false);
        if (hits.length === 0) return null;

        let obj = hits[0].object;
        while (obj) {
            if (meshToGroup.has(obj)) return meshToGroup.get(obj);
            if (movables.includes(obj)) return obj;
            obj = obj.parent;
        }
        return null;
    }

    /** 松开时将 crossWall 物体吸附到最近的墙面，并旋转朝向 */
    function snapToNearestWall(obj) {
        const p = obj.position;
        const dists = [
            { wall: 'wall-left',  dist: Math.abs(p.x + ROOM_HALF_W), setPos: () => { p.x = -ROOM_HALF_W; }, rotY: Math.PI / 2 },
            { wall: 'wall-right', dist: Math.abs(p.x - ROOM_HALF_W), setPos: () => { p.x =  ROOM_HALF_W; }, rotY: -Math.PI / 2 },
            { wall: 'wall-back',  dist: Math.abs(p.z + ROOM_HALF_D), setPos: () => { p.z = -ROOM_HALF_D; }, rotY: 0 },
            { wall: 'wall-front', dist: Math.abs(p.z - ROOM_HALF_D), setPos: () => { p.z =  ROOM_HALF_D; }, rotY: Math.PI },
        ];
        dists.sort((a, b) => a.dist - b.dist);
        const nearest = dists[0];
        nearest.setPos();
        obj.rotation.y = nearest.rotY;
        obj.userData.surface = nearest.wall;
    }

    /** 松开时将小物品吸附到最近的表面（向下 raycast），并建立父子关系 */
    function snapToSurface(obj) {
        const p = obj.position;

        // 用几何尺寸计算偏移（与位置无关，避免漂移）
        obj.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(obj);
        const size = new THREE.Vector3();
        box.getSize(size);
        obj.userData.itemBottomOffset = size.y / 2;
        const itemBottom = obj.userData.itemBottomOffset;

        // 临时隐藏被拖拽物品自身，避免 raycast 命中自己
        const hidden = [];
        obj.traverse(child => {
            if (child.isMesh) { child.visible = false; hidden.push(child); }
        });

        // 从物品位置向下 raycast
        const downRay = new THREE.Raycaster(
            new THREE.Vector3(p.x, p.y + SNAP_RAY_Y_OFFSET, p.z),
            new THREE.Vector3(0, -1, 0),
        );
        const allMeshes = [];
        scene.traverse(child => { if (child.isMesh) allMeshes.push(child); });
        const hits = downRay.intersectObjects(allMeshes, false);

        // 恢复显示
        hidden.forEach(m => { m.visible = true; });

        // 找最高的、在物品下方的表面，并记录命中的物体
        let bestY = 0; // 默认地面
        let bestHitObj = null; // 命中的家具
        for (const hit of hits) {
            const surfaceY = hit.point.y;
            if (surfaceY <= p.y + SNAP_SURFACE_TOLERANCE && surfaceY > bestY) {
                bestY = surfaceY;
                bestHitObj = hit.object;
            }
        }

        p.y = bestY + itemBottom;

        // DEBUG
        console.log('[snapToSurface]', {
            bestY: bestY.toFixed(3),
            itemBottom: itemBottom.toFixed(3),
            finalY: p.y.toFixed(3),
            bestHitObj: bestHitObj?.type || 'none',
        });

        // ── 动态父子关系：找到小物品下方的家具，建立携带关系 ──
        // 先清除旧的父子关系
        if (obj.userData.parentGroup) {
            const oldParent = obj.userData.parentGroup;
            if (oldParent.userData.children) {
                oldParent.userData.children = oldParent.userData.children.filter(c => c !== obj);
            }
            obj.userData.parentGroup = null;
        }

        // 向上查找命中 mesh 所属的可移动家具 Group
        if (bestHitObj) {
            let parentCandidate = bestHitObj;
            while (parentCandidate) {
                if (movables.includes(parentCandidate) && parentCandidate !== obj
                    && parentCandidate.userData.movableType !== 'small-item') {
                    // 找到父家具，建立关系
                    obj.userData.parentGroup = parentCandidate;
                    if (!parentCandidate.userData.children) parentCandidate.userData.children = [];
                    if (!parentCandidate.userData.children.includes(obj)) {
                        parentCandidate.userData.children.push(obj);
                    }
                    break;
                }
                parentCandidate = parentCandidate.parent;
            }
        }
    }

    // ── 边界限制（基于物体 bounding box） ──

    /** 缓存物体的半尺寸（拖拽开始时计算一次） */
    function cacheHalfExtents(obj) {
        const box = new THREE.Box3().setFromObject(obj);
        obj.userData._he = new THREE.Vector3(
            (box.max.x - box.min.x) / 2,
            (box.max.y - box.min.y) / 2,
            (box.max.z - box.min.z) / 2
        );
    }

    // ── 地面家具碰撞检测 ──

    /** 获取所有地面家具（排除指定物体和不参与碰撞的装饰层） */
    function getFloorMovables(exclude) {
        return movables.filter(m =>
            m !== exclude && (m.userData.surface || 'floor') === 'floor' && m.userData.movableType !== 'small-item' && !m.userData.noCollision
        );
    }

    /** 两个地面物体在 xz 平面的重叠量，无重叠返回 null */
    function getOverlap(a, b) {
        const heA = a.userData._he;
        const heB = b.userData._he;
        if (!heA || !heB) return null;

        const dx = a.position.x - b.position.x;
        const dz = a.position.z - b.position.z;
        const overlapX = heA.x + heB.x - Math.abs(dx);
        const overlapZ = heA.z + heB.z - Math.abs(dz);

        if (overlapX <= 0 || overlapZ <= 0) return null;
        return { overlapX, overlapZ, dx, dz };
    }

    /** 将 obj 与其他地面家具分离（最小平移向量） */
    function resolveCollisions(obj) {
        const others = getFloorMovables(obj);
        for (let iter = 0; iter < 8; iter++) {
            let resolved = true;
            for (const other of others) {
                const ov = getOverlap(obj, other);
                if (!ov) continue;
                resolved = false;
                // 沿重叠较小的轴推开
                if (ov.overlapX < ov.overlapZ) {
                    const sign = ov.dx >= 0 ? 1 : -1;
                    obj.position.x += sign * ov.overlapX;
                } else {
                    const sign = ov.dz >= 0 ? 1 : -1;
                    obj.position.z += sign * ov.overlapZ;
                }
            }
            if (resolved) break;
        }
    }

    function clampToRoom(obj) {
        const p = obj.position;
        const he = obj.userData._he || { x: 0, y: 0, z: 0 };
        const surface = obj.userData.surface || 'floor';

        if (obj.userData.movableType === 'small-item') {
            p.x = Math.max(-ROOM_HALF_W + he.x, Math.min(ROOM_HALF_W - he.x, p.x));
            p.z = Math.max(-ROOM_HALF_D + he.z, Math.min(ROOM_HALF_D - he.z, p.z));
            p.y = Math.max(he.y, Math.min(ROOM_HEIGHT - he.y, p.y));
        } else if (surface === 'floor') {
            p.x = Math.max(-ROOM_HALF_W + he.x, Math.min(ROOM_HALF_W - he.x, p.x));
            p.z = Math.max(-ROOM_HALF_D + he.z, Math.min(ROOM_HALF_D - he.z, p.z));
        } else if (surface === 'wall-left' || surface === 'wall-right') {
            p.y = Math.max(he.y, Math.min(ROOM_HEIGHT - he.y, p.y));
            p.z = Math.max(-ROOM_HALF_D + he.z, Math.min(ROOM_HALF_D - he.z, p.z));
        } else if (surface === 'wall-back') {
            p.x = Math.max(-ROOM_HALF_W + he.x, Math.min(ROOM_HALF_W - he.x, p.x));
            p.y = Math.max(he.y, Math.min(ROOM_HEIGHT - he.y, p.y));
        } else if (surface === 'wall-front') {
            p.x = Math.max(-ROOM_HALF_W + he.x, Math.min(ROOM_HALF_W - he.x, p.x));
            p.y = Math.max(he.y, Math.min(ROOM_HEIGHT - he.y, p.y));
        }
    }

    // ── 事件处理 ──

    function onPointerDown(event) {
        if (event.button !== 0) return;

        const hit = findMovableUnderMouse(event);
        if (!hit) return;

        selected = hit;
        activePlane = getPlaneForObject(selected);
        isDragging = true;
        cacheHalfExtents(selected);
        // 缓存所有地面家具的半尺寸（碰撞检测用）
        for (const m of getFloorMovables(selected)) cacheHalfExtents(m);

        // ── 小物品：从父物体的 children 列表中独立出来 ──
        if (selected.userData.parentGroup) {
            const parent = selected.userData.parentGroup;
            if (parent.userData.children) {
                parent.userData.children = parent.userData.children.filter(c => c !== selected);
            }
            selected.userData.parentGroup = null;
        }

        // ── 父物体：缓存子物体相对偏移 ──
        if (selected.userData.children && selected.userData.children.length > 0) {
            childOffsets = selected.userData.children.map(child => ({
                child,
                offset: new THREE.Vector3().copy(child.position).sub(selected.position),
            }));
        } else {
            childOffsets = null;
        }

        const planeHit = raycastToPlane(event, activePlane);
        offset.copy(selected.position).sub(planeHit);

        orbitControls.enabled = false;
        renderer.domElement.style.cursor = 'grabbing';
    }

    function onPointerMove(event) {
        if (isDragging && selected) {
            const planeHit = raycastToPlane(event, activePlane);
            if (!planeHit) return;

            const surface = selected.userData.surface || 'floor';

            if (selected.userData.movableType === 'small-item') {
                // 小物品：从相机 raycast 检测鼠标下方的表面，直接放置
                getMouseNDC(event);
                raycaster.setFromCamera(mouse, camera);

                // 临时隐藏被拖拽物品
                const hidden = [];
                selected.traverse(c => { if (c.isMesh) { c.visible = false; hidden.push(c); } });
                const hits = raycaster.intersectObjects(scene.children, true);
                hidden.forEach(m => { m.visible = true; });

                // 过滤掉被拖拽物品的 mesh
                const validHits = hits.filter(h => {
                    let obj = h.object;
                    while (obj) { if (obj === selected) return false; obj = obj.parent; }
                    return true;
                });

                if (validHits.length > 0) {
                    const itemBottom = selected.userData.itemBottomOffset || 0;
                    // 找最高的命中点（鼠标指向的最近表面）
                    let bestPoint = validHits[0].point;
                    for (const h of validHits) {
                        if (h.point.y > bestPoint.y) bestPoint = h.point;
                    }
                    selected.position.x = bestPoint.x;
                    selected.position.y = bestPoint.y + itemBottom;
                    selected.position.z = bestPoint.z;
                }
            } else if (surface === 'floor') {
                selected.position.x = planeHit.x + offset.x;
                selected.position.z = planeHit.z + offset.z;
            } else if (surface === 'wall-left' || surface === 'wall-right') {
                selected.position.y = planeHit.y + offset.y;
                selected.position.z = planeHit.z + offset.z;

                if (selected.userData.crossWall) {
                    if (selected.position.z >= ROOM_HALF_D) {
                        selected.position.z = ROOM_HALF_D;
                        selected.userData.surface = 'wall-front';
                        activePlane = PLANES['wall-front'];
                        const newHit = raycastToPlane(event, activePlane);
                        offset.copy(selected.position).sub(newHit);
                    } else if (selected.position.z <= -ROOM_HALF_D) {
                        selected.position.z = -ROOM_HALF_D;
                        selected.userData.surface = 'wall-back';
                        activePlane = PLANES['wall-back'];
                        const newHit = raycastToPlane(event, activePlane);
                        offset.copy(selected.position).sub(newHit);
                    }
                }
            } else if (surface === 'wall-back') {
                selected.position.x = planeHit.x + offset.x;
                selected.position.y = planeHit.y + offset.y;

                if (selected.userData.crossWall) {
                    if (selected.position.x >= ROOM_HALF_W) {
                        selected.position.x = ROOM_HALF_W;
                        selected.userData.surface = 'wall-right';
                        activePlane = PLANES['wall-right'];
                        const newHit = raycastToPlane(event, activePlane);
                        offset.copy(selected.position).sub(newHit);
                    } else if (selected.position.x <= -ROOM_HALF_W) {
                        selected.position.x = -ROOM_HALF_W;
                        selected.userData.surface = 'wall-left';
                        activePlane = PLANES['wall-left'];
                        const newHit = raycastToPlane(event, activePlane);
                        offset.copy(selected.position).sub(newHit);
                    }
                }
            } else if (surface === 'wall-front') {
                selected.position.x = planeHit.x + offset.x;
                selected.position.y = planeHit.y + offset.y;

                if (selected.userData.crossWall) {
                    if (selected.position.x >= ROOM_HALF_W) {
                        selected.position.x = ROOM_HALF_W;
                        selected.userData.surface = 'wall-right';
                        activePlane = PLANES['wall-right'];
                        const newHit = raycastToPlane(event, activePlane);
                        offset.copy(selected.position).sub(newHit);
                    } else if (selected.position.x <= -ROOM_HALF_W) {
                        selected.position.x = -ROOM_HALF_W;
                        selected.userData.surface = 'wall-left';
                        activePlane = PLANES['wall-left'];
                        const newHit = raycastToPlane(event, activePlane);
                        offset.copy(selected.position).sub(newHit);
                    }
                }
            }

            // ── 同步子物体位置 ──
            if (childOffsets) {
                for (const co of childOffsets) {
                    co.child.position.copy(selected.position).add(co.offset);
                }
            }

            // 限制在房间范围内
            clampToRoom(selected);
            // 地面家具碰撞分离
            if ((selected.userData.surface || 'floor') === 'floor' && selected.userData.movableType !== 'small-item') {
                resolveCollisions(selected);
                clampToRoom(selected);
                // 碰撞修正后重新同步子物体
                if (childOffsets) {
                    for (const co of childOffsets) {
                        co.child.position.copy(selected.position).add(co.offset);
                    }
                }
            }
            return;
        }

        const hit = findMovableUnderMouse(event);
        renderer.domElement.style.cursor = hit ? 'grab' : '';
    }

    function onPointerUp(event) {
        if (event.button !== 0) return;
        if (isDragging) {
            if (selected) {
                if (selected.userData.crossWall) {
                    snapToNearestWall(selected);
                } else if (selected.userData.movableType === 'small-item') {
                    snapToSurface(selected);
                }
            }
            isDragging = false;
            selected = null;
            activePlane = null;
            childOffsets = null;
            orbitControls.enabled = true;
            renderer.domElement.style.cursor = '';
            if (options.onDrop) options.onDrop();
        }
    }

    // ── 旋转：键盘 Q/E 水平旋转45°，小物品 R 垂直翻转 ──

    function onKeyDown(event) {
        if (!selected) return;
        const key = event.key.toLowerCase();

        if (key === 'q' || key === 'e') {
            // 水平旋转 45°
            const angle = (key === 'e' ? 1 : -1) * Math.PI / 4;
            selected.rotation.y += angle;
            // 旋转后更新子物体偏移
            if (childOffsets) {
                for (const co of childOffsets) {
                    // 重新计算子物体位置（旋转后偏移也需要旋转）
                    co.offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
                    co.child.position.copy(selected.position).add(co.offset);
                }
            }
            // 地面家具旋转后重新碰撞检测
            if ((selected.userData.surface || 'floor') === 'floor' && selected.userData.movableType !== 'small-item') {
                cacheHalfExtents(selected);
                resolveCollisions(selected);
                clampToRoom(selected);
            }
            // 小物品旋转后更新吸附偏移
            if (selected.userData.movableType === 'small-item') {
                selected.updateMatrixWorld(true);
                const box = new THREE.Box3().setFromObject(selected);
                const size = new THREE.Vector3();
                box.getSize(size);
                selected.userData.itemBottomOffset = size.y / 2;
            }
        }

        if (key === 'r' && selected.userData.movableType === 'small-item') {
            // 垂直翻转：在"平躺"和"站立"两个状态间切换
            // BoxGeometry 参数约定：width=第二长边, height=最短边, depth=最长边
            // rotation.x = nπ     → 最短边(height)沿 Y → 平躺（最大面朝上下）
            // rotation.x = nπ+π/2 → 最长边(depth)沿 Y → 站立（最小面朝上下）
            const constraint = selected.userData.rotationConstraint || 'horizontal';
            if (constraint === 'any') {
                selected.rotation.x += Math.PI / 2;
                // 用几何尺寸重算偏移（旋转后需要重新计算包围盒）
                selected.updateMatrixWorld(true);
                const bbAfter = new THREE.Box3().setFromObject(selected);
                const size = new THREE.Vector3();
                bbAfter.getSize(size);
                selected.userData.itemBottomOffset = size.y / 2;
                // DEBUG
                console.log('[R pressed]', {
                    rotX: (selected.rotation.x * 180 / Math.PI).toFixed(0) + '°',
                    posY: selected.position.y.toFixed(3),
                    bbMinY: bbAfter.min.y.toFixed(3),
                    bbMaxY: bbAfter.max.y.toFixed(3),
                    sizeY: size.y.toFixed(3),
                    offset: (size.y / 2).toFixed(3),
                });
                // 非拖拽状态下立即重新吸附到表面
                if (!isDragging) snapToSurface(selected);
            }
            // 'horizontal' 约束的物品（如盆栽）按 R 无反应
        }
    }

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    document.addEventListener('keydown', onKeyDown);

    return {
        dispose() {
            renderer.domElement.removeEventListener('pointerdown', onPointerDown);
            renderer.domElement.removeEventListener('pointermove', onPointerMove);
            renderer.domElement.removeEventListener('pointerup', onPointerUp);
            document.removeEventListener('keydown', onKeyDown);
        },
        updateMovables(newMovables) {
            movables.length = 0;
            movables.push(...newMovables);
            buildPickMap();
        }
    };
}
