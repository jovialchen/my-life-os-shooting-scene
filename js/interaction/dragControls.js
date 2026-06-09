/**
 * 拖拽控制器：点击选中物体，沿所在平面拖拽移动
 * - 地面物体（floor）：沿 y=0 平面移动（x, z）
 * - 墙面物体（wall-*）：沿对应墙面移动（y + 墙面水平方向）
 * - crossWall 物体：沿墙面移动，到角落可切换到相邻墙面
 * - 小物品（small-item）：在当前高度水平移动，松开时吸附到最近表面
 *
 * 通过 obj.userData 标记：
 *   .surface      — 'floor' | 'wall-left' | 'wall-right' | 'wall-back' | 'wall-front'
 *   .crossWall    — true 表示可在墙面间切换
 *   .movableType  — 'small-item' 表示小物品
 *   .surfaceHeights — [number] 小物品的子 mesh 底部到中心的偏移（用于吸附）
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

    /** 松开时将小物品吸附到最近的表面（向下 raycast） */
    function snapToSurface(obj) {
        const p = obj.position;
        const itemBottom = obj.userData.itemBottomOffset || 0;

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

        // 找最高的、在物品下方的表面
        let bestY = 0; // 默认地面
        for (const hit of hits) {
            const surfaceY = hit.point.y;
            if (surfaceY <= p.y + SNAP_SURFACE_TOLERANCE && surfaceY > bestY) {
                bestY = surfaceY;
            }
        }

        p.y = bestY + itemBottom;
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

    /** 获取所有地面家具（排除指定物体） */
    function getFloorMovables(exclude) {
        return movables.filter(m =>
            m !== exclude && (m.userData.surface || 'floor') === 'floor' && m.userData.movableType !== 'small-item'
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

            // 限制在房间范围内
            clampToRoom(selected);
            // 地面家具碰撞分离
            if ((selected.userData.surface || 'floor') === 'floor' && selected.userData.movableType !== 'small-item') {
                resolveCollisions(selected);
                clampToRoom(selected);
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
            orbitControls.enabled = true;
            renderer.domElement.style.cursor = '';
            if (options.onDrop) options.onDrop();
        }
    }

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    return {
        dispose() {
            renderer.domElement.removeEventListener('pointerdown', onPointerDown);
            renderer.domElement.removeEventListener('pointermove', onPointerMove);
            renderer.domElement.removeEventListener('pointerup', onPointerUp);
        },
        updateMovables(newMovables) {
            movables.length = 0;
            movables.push(...newMovables);
            buildPickMap();
        }
    };
}
