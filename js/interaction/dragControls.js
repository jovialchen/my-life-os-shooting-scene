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

    /** 记录书本所在的表面 Y 坐标（旋转时用来避免重复 raycast） */
    function storeSurfaceY(obj) {
        const bottom = obj.position.y - (obj.userData.itemBottomOffset || 0);
        obj.userData._surfaceY = bottom;
    }

    /**
     * 从小物品当前位置向下 raycast，找到下方的家具并建立父子关系
     * 不改变物品位置，只建立 parent ↔ children 关系
     */
    function findParentBelow(obj) {
        // 用世界坐标做 raycast（obj.position 可能是父物体的局部坐标）
        const worldPos = new THREE.Vector3();
        obj.getWorldPosition(worldPos);

        // 临时隐藏自身 mesh
        const hidden = [];
        obj.traverse(child => {
            if (child.isMesh) { child.visible = false; hidden.push(child); }
        });

        const downRay = new THREE.Raycaster(
            new THREE.Vector3(worldPos.x, worldPos.y + SNAP_RAY_Y_OFFSET, worldPos.z),
            new THREE.Vector3(0, -1, 0),
        );
        const allMeshes = [];
        scene.traverse(child => { if (child.isMesh) allMeshes.push(child); });
        const hits = downRay.intersectObjects(allMeshes, false);

        hidden.forEach(m => { m.visible = true; });

        // 找最高的、在物品下方的表面（世界坐标比较）
        let bestHitObj = null;
        let bestY = -Infinity;
        for (const hit of hits) {
            const surfaceY = hit.point.y;
            if (surfaceY <= worldPos.y + SNAP_SURFACE_TOLERANCE && surfaceY > bestY) {
                bestY = surfaceY;
                bestHitObj = hit.object;
            }
        }

        // 清除旧的父子关系
        if (obj.userData.parentGroup) {
            const oldParent = obj.userData.parentGroup;
            if (oldParent.userData.children) {
                oldParent.userData.children = oldParent.userData.children.filter(c => c !== obj);
            }
            obj.userData.parentGroup = null;
        }

        // 向上查找命中 mesh 所属的可移动家具 Group
        let foundParent = null;
        if (bestHitObj) {
            let parentCandidate = bestHitObj;
            while (parentCandidate) {
                if (movables.includes(parentCandidate) && parentCandidate !== obj
                    && parentCandidate.userData.movableType !== 'small-item') {
                    obj.userData.parentGroup = parentCandidate;
                    if (!parentCandidate.userData.children) parentCandidate.userData.children = [];
                    if (!parentCandidate.userData.children.includes(obj)) {
                        parentCandidate.userData.children.push(obj);
                    }
                    foundParent = parentCandidate;
                    break;
                }
                parentCandidate = parentCandidate.parent;
            }
        }

        console.log('[findParentBelow]', {
            bestY: bestY.toFixed(3),
            bestHitObj: bestHitObj?.type || 'none',
            foundParent: foundParent?.userData?.name || 'none',
            bookPos: obj.position.y.toFixed(3),
        });

        return foundParent;
    }

    /**
     * 松开时将小物品吸附到最近的表面，并建立父子关系
     * 如果 lastDragHitObj 存在（拖拽放下），直接用它找 parent，不重新定位
     * 如果不存在（R 键等），走完整 raycast 流程
     */
    function snapToSurface(obj) {
        const p = obj.position;

        // ── 清除旧的父子关系 ──
        if (obj.userData.parentGroup) {
            const oldParent = obj.userData.parentGroup;
            if (oldParent.userData.children) {
                oldParent.userData.children = oldParent.userData.children.filter(c => c !== obj);
            }
            obj.userData.parentGroup = null;
        }

        // ── 模式 A：拖拽放下 — 用向下 raycast 找 parent，不改位置 ──
        if (lastDragHitObj) {
            lastDragHitObj = null;

            // 更新 itemBottomOffset（group 原点到包围盒底部的距离）
            obj.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(obj);
            obj.userData.itemBottomOffset = obj.position.y - box.min.y;
            storeSurfaceY(obj);

            // 用可靠的向下 raycast 找父物体（不依赖拖拽最后一帧的命中）
            findParentBelow(obj);
            return;
        }

        // ── 模式 B：非拖拽（R 键等）— 向下 raycast 找表面并重新定位 ──
        const posBefore = p.y;

        obj.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(obj);
        obj.userData.itemBottomOffset = obj.position.y - box.min.y;
        const itemBottom = obj.userData.itemBottomOffset;

        // 临时隐藏自身，避免 raycast 命中自己
        const hidden = [];
        obj.traverse(child => {
            if (child.isMesh) { child.visible = false; hidden.push(child); }
        });

        const downRay = new THREE.Raycaster(
            new THREE.Vector3(p.x, p.y + SNAP_RAY_Y_OFFSET, p.z),
            new THREE.Vector3(0, -1, 0),
        );
        const allMeshes = [];
        scene.traverse(child => { if (child.isMesh) allMeshes.push(child); });
        const hits = downRay.intersectObjects(allMeshes, false);

        hidden.forEach(m => { m.visible = true; });

        let bestY = -Infinity;
        let bestHitObj = null;
        for (const hit of hits) {
            const surfaceY = hit.point.y;
            if (surfaceY <= p.y + SNAP_SURFACE_TOLERANCE && surfaceY > bestY) {
                bestY = surfaceY;
                bestHitObj = hit.object;
            }
        }

        // 如果没找到任何表面（如地板 Y=0 被遗漏），用地面数学平面兜底
        if (!bestHitObj) bestY = 0;

        p.y = bestY + itemBottom;
        storeSurfaceY(obj);

        console.log('[snapToSurface:raycast]', {
            posBefore: posBefore.toFixed(4),
            boxMinY: box.min.y.toFixed(4),
            itemBottomOffset: obj.userData.itemBottomOffset.toFixed(4),
            bestY: bestY.toFixed(4),
            finalY: p.y.toFixed(4),
            usedFallback: !bestHitObj,
            hitName: bestHitObj?.parent?.userData?.name || bestHitObj?.name || 'none',
        });

        // 向上查找命中 mesh 所属的可移动家具 Group
        if (bestHitObj) {
            let parentCandidate = bestHitObj;
            while (parentCandidate) {
                if (movables.includes(parentCandidate) && parentCandidate !== obj
                    && parentCandidate.userData.movableType !== 'small-item') {
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
        const he = obj.userData._he;
        // 房间边界（obj 能到达的最小/最大坐标）
        const minX = -ROOM_HALF_W + he.x, maxX = ROOM_HALF_W - he.x;
        const minZ = -ROOM_HALF_D + he.z, maxZ = ROOM_HALF_D - he.z;

        for (let iter = 0; iter < 8; iter++) {
            let resolved = true;
            for (const other of others) {
                const ov = getOverlap(obj, other);
                if (!ov) continue;
                resolved = false;

                if (ov.overlapX < ov.overlapZ) {
                    const sign = ov.dx >= 0 ? 1 : -1;
                    const desired = obj.position.x + sign * ov.overlapX;
                    const clamped = Math.max(minX, Math.min(maxX, desired));
                    obj.position.x = clamped;
                    // 如果被墙挡住了（clamped != desired），剩余推力转给对方
                    const remainder = desired - clamped;
                    if (Math.abs(remainder) > 0.001) {
                        other.position.x -= remainder;
                    }
                } else {
                    const sign = ov.dz >= 0 ? 1 : -1;
                    const desired = obj.position.z + sign * ov.overlapZ;
                    const clamped = Math.max(minZ, Math.min(maxZ, desired));
                    obj.position.z = clamped;
                    const remainder = desired - clamped;
                    if (Math.abs(remainder) > 0.001) {
                        other.position.z -= remainder;
                    }
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
            const bottom = obj.userData.itemBottomOffset || 0;
            p.x = Math.max(-ROOM_HALF_W + he.x, Math.min(ROOM_HALF_W - he.x, p.x));
            p.z = Math.max(-ROOM_HALF_D + he.z, Math.min(ROOM_HALF_D - he.z, p.z));
            p.y = Math.max(bottom, Math.min(ROOM_HEIGHT - he.y, p.y));
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

    let downScreenPos = { x: 0, y: 0 }; // pointerdown 时的屏幕坐标
    let lastDragHitObj = null; // 拖拽时命中的 mesh（用于 snapToSurface 建立 parent）

    function onPointerDown(event) {
        if (event.button !== 0) return;

        const hit = findMovableUnderMouse(event);
        if (!hit) return;

        // 地毯需要按住 Shift 才能抓取，防止误触
        if (hit.userData.noCollision && !event.shiftKey) return;

        selected = hit;
        activePlane = getPlaneForObject(selected);
        isDragging = true;
        downScreenPos = { x: event.clientX, y: event.clientY };
        lastDragHitObj = null;
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
            selected.userData._surfaceY = null; // 清除旧表面记录，防止残留值干扰旋转
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
                // 小物品：用向下 raycast 找鼠标下方的实际表面
                // 1. 从鼠标位置算出地面 XZ 坐标
                const floorHit = raycastToPlane(event, PLANES['floor']);
                if (!floorHit) return;

                // 2. 从正上方向下 raycast
                const downOrigin = new THREE.Vector3(floorHit.x, SNAP_RAY_Y_OFFSET + 2, floorHit.z);
                const downRay = new THREE.Raycaster(downOrigin, new THREE.Vector3(0, -1, 0));

                // 临时隐藏被拖拽物品
                const hidden = [];
                selected.traverse(c => { if (c.isMesh) { c.visible = false; hidden.push(c); } });
                const hits = downRay.intersectObjects(scene.children, true);
                hidden.forEach(m => { m.visible = true; });

                // 3. 过滤：排除自身 mesh、墙面、天花板
                const validHits = hits.filter(h => {
                    // 排除被拖拽物品
                    let obj = h.object;
                    while (obj) { if (obj === selected) return false; obj = obj.parent; }
                    // 排除墙面和天花板
                    let p = h.object;
                    while (p) {
                        if (p.userData?.wallType) return false;
                        p = p.parent;
                    }
                    // 排除天花板（Y 接近房间高度的水平面）
                    if (h.point.y > ROOM_HEIGHT - 0.1) return false;
                    return true;
                });

                if (validHits.length > 0) {
                    const itemBottom = selected.userData.itemBottomOffset || 0;
                    // 取最高 Y 的命中（鼠标下方最近的表面）
                    let bestPoint = validHits[0].point;
                    let bestObj = validHits[0].object;
                    for (const h of validHits) {
                        if (h.point.y > bestPoint.y) { bestPoint = h.point; bestObj = h.object; }
                    }
                    selected.position.x = bestPoint.x;
                    selected.position.y = bestPoint.y + itemBottom;
                    selected.position.z = bestPoint.z;
                    storeSurfaceY(selected);
                    lastDragHitObj = bestObj; // 缓存命中的 mesh
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
        if (hit && hit.userData.noCollision && !event.shiftKey) {
            renderer.domElement.style.cursor = 'default'; // 地毯：需要 Shift
        } else {
            renderer.domElement.style.cursor = hit ? 'grab' : '';
        }
    }

    function onPointerUp(event) {
        if (event.button !== 0) return;
        if (isDragging) {
            // 用屏幕像素距离判断是否有实际拖拽（避免微小移动误判）
            const dx = event.clientX - downScreenPos.x;
            const dy = event.clientY - downScreenPos.y;
            const didDrag = Math.sqrt(dx * dx + dy * dy) > 3; // 3px 阈值

            console.log('[onPointerUp]', {
                didDrag,
                selected: selected?.userData?.name || 'none',
                parent: selected?.userData?.parentGroup?.userData?.name || 'none',
            });
            if (selected && didDrag) {
                if (selected.userData.crossWall) {
                    snapToNearestWall(selected);
                } else if (selected.userData.movableType === 'small-item') {
                    snapToSurface(selected);
                }
            }
            isDragging = false;
            lastDragHitObj = null; // 清除拖拽缓存
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
            // 水平旋转 45°（绕世界 Y 轴，确保平躺物体如地毯在地面旋转）
            const angle = (key === 'e' ? 1 : -1) * Math.PI / 4;
            const worldY = new THREE.Vector3(0, 1, 0);
            selected.rotateOnWorldAxis(worldY, angle);
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
                selected.userData.itemBottomOffset = selected.position.y - box.min.y;
            }
        }

        if (key === 'r' && selected.userData.movableType === 'small-item') {
            // 垂直翻转：在"平躺"和"站立"两个状态间切换
            // BoxGeometry 参数约定：width=第二长边, height=最短边, depth=最长边
            // rotation.x = nπ     → 最短边(height)沿 Y → 平躺（最大面朝上下）
            // rotation.x = nπ+π/2 → 最长边(depth)沿 Y → 站立（最小面朝上下）
            const constraint = selected.userData.rotationConstraint || 'horizontal';
            if (constraint === 'any') {
                // ── 旋转前：记录底面在世界坐标中的 Y ──
                selected.updateMatrixWorld(true);
                const worldBefore = new THREE.Vector3();
                selected.getWorldPosition(worldBefore);
                const oldItemBottom = selected.userData.itemBottomOffset || 0;
                const bottomWorldY = worldBefore.y - oldItemBottom;

                // ── 执行旋转 ──
                selected.rotation.x += Math.PI / 2;

                // ── 旋转后：重算包围盒和底面偏移（世界坐标） ──
                selected.updateMatrixWorld(true);
                const bbAfter = new THREE.Box3().setFromObject(selected);
                const newItemBottom = worldBefore.y - bbAfter.min.y; // 暂用旋转前的世界Y
                selected.userData.itemBottomOffset = newItemBottom;

                // ── 关键：以底面为锚点修正位置 ──
                // 新世界Y = 旧底面世界Y + 新底面偏移
                const newWorldY = bottomWorldY + newItemBottom;
                // 转换回父物体局部坐标
                if (selected.parent) {
                    const parentWorldInv = new THREE.Matrix4().copy(selected.parent.matrixWorld).invert();
                    const worldPos = new THREE.Vector3();
                    selected.getWorldPosition(worldPos);
                    worldPos.y = newWorldY;
                    worldPos.applyMatrix4(parentWorldInv);
                    selected.position.copy(worldPos);
                } else {
                    selected.position.y = newWorldY;
                }
                selected.updateMatrixWorld(true);
                // 更新 itemBottomOffset 为最终值
                const bbFinal = new THREE.Box3().setFromObject(selected);
                selected.userData.itemBottomOffset = selected.position.y - bbFinal.min.y;
                storeSurfaceY(selected);

                // 重建父子关系（只找 parent，不改位置）
                findParentBelow(selected);
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
