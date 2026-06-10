/**
 * 公寓管理器
 *
 * 管理所有房间的构建、可见性、切换
 * 实现 docs/room-visibility-design.md 中的房间级可见性方案
 */
import * as THREE from 'three';
import { buildRoom } from './elements/index.js';

// ── 房间切换检测参数 ──
const DOOR_DETECT_RADIUS = 0.6;  // 门口检测半径（米）

/**
 * 公寓管理器
 */
export class Apartment {
    constructor() {
        /** @type {Map<string, object>} id → 房间数据 */
        this.rooms = new Map();
        /** @type {string} 当前房间 ID */
        this.currentRoomId = null;
        /** @type {THREE.Scene} */
        this.scene = null;
        /** @type {Function|null} 房间切换回调 */
        this.onRoomSwitch = null;
    }

    /**
     * 注册一个房间
     * @param {string} id
     * @param {object} config - 传给 buildRoom() 的配置
     * @param {{ x: number, z: number }} position - 房间中心在世界坐标中的位置
     */
    addRoom(id, config, position) {
        const result = buildRoom(config);

        // 将房间 group 移到指定世界位置
        result.group.position.set(position.x, 0, position.z);

        const halfW = config.size.width / 2;
        const halfD = config.size.depth / 2;

        this.rooms.set(id, {
            id,
            config,
            result,
            position: new THREE.Vector3(position.x, 0, position.z),
            bounds: { halfW, halfD },
            connections: [],
        });
    }

    /**
     * 设置房间之间的连接关系
     * @param {string} fromRoomId
     * @param {string} toRoomId
     * @param {{ x: number, z: number }} doorWorldPos - 门口在世界坐标中的位置
     */
    addConnection(fromRoomId, toRoomId, doorWorldPos) {
        const from = this.rooms.get(fromRoomId);
        const to = this.rooms.get(toRoomId);
        if (!from || !to) return;

        from.connections.push({ targetRoom: toRoomId, doorPos: doorWorldPos });
        to.connections.push({ targetRoom: fromRoomId, doorPos: doorWorldPos });
    }

    /**
     * 构建所有房间并添加到场景
     * @param {THREE.Scene} scene
     * @param {string} initialRoomId - 初始显示的房间
     */
    build(scene, initialRoomId) {
        this.scene = scene;

        // 添加所有房间到场景
        for (const [, room] of this.rooms) {
            scene.add(room.result.group);
        }

        // 设置初始房间并更新可见性
        this.currentRoomId = initialRoomId;
        this.updateVisibility();
    }

    /**
     * 获取当前房间数据
     * @returns {object|null}
     */
    getCurrentRoom() {
        return this.rooms.get(this.currentRoomId) || null;
    }

    /**
     * 获取当前房间边界（供寻路和拖拽使用）
     * @returns {{ halfW: number, halfD: number, centerX: number, centerZ: number }}
     */
    getCurrentRoomBounds() {
        const room = this.getCurrentRoom();
        if (!room) return { halfW: 4, halfD: 3.5, centerX: 0, centerZ: 0 };
        return {
            halfW: room.bounds.halfW,
            halfD: room.bounds.halfD,
            centerX: room.position.x,
            centerZ: room.position.z,
        };
    }

    /**
     * 切换当前房间
     * @param {string} roomId
     * @param {THREE.Vector3} [fromPos] - 切换前的角色位置（用于计算传送点）
     * @returns {{ x: number, z: number }|null} 新房间的入口位置
     */
    switchRoom(roomId, fromPos) {
        if (roomId === this.currentRoomId) return null;
        const newRoom = this.rooms.get(roomId);
        if (!newRoom) return null;

        const prevRoomId = this.currentRoomId;
        const oldRoom = this.rooms.get(prevRoomId);
        this.currentRoomId = roomId;

        // 更新可见性（当前房间 + 门打开的相邻房间）
        this.updateVisibility();

        // 计算传送点：从旧房间门口进入新房间的位置
        let entryPos = null;
        if (fromPos && oldRoom) {
            // 找到连接旧房间和新房间的门口位置
            for (const conn of oldRoom.connections) {
                if (conn.targetRoom === roomId) {
                    const doorPos = conn.doorPos;
                    // 计算进入新房间的方向
                    const dx = newRoom.position.x - oldRoom.position.x;
                    const dz = newRoom.position.z - oldRoom.position.z;
                    const len = Math.sqrt(dx * dx + dz * dz);
                    if (len > 0) {
                        // 传送点：门口位置 + 向新房间方向偏移 0.5m
                        entryPos = {
                            x: doorPos.x + (dx / len) * 0.5,
                            z: doorPos.z + (dz / len) * 0.5,
                        };
                    }
                    break;
                }
            }
        }

        // 触发回调
        if (this.onRoomSwitch) {
            this.onRoomSwitch(roomId, prevRoomId, entryPos);
        }

        return entryPos;
    }

    /**
     * 更新房间可见性：当前房间 + 门打开的相邻房间都显示
     */
    updateVisibility() {
        const room = this.getCurrentRoom();
        if (!room) return;

        // 先隐藏所有房间
        for (const [, r] of this.rooms) {
            r.result.group.visible = false;
        }

        // 显示当前房间
        room.result.group.visible = true;

        // 显示门打开的相邻房间
        if (room.connections) {
            const door = room.result.door;
            for (const conn of room.connections) {
                // 检查当前房间的门是否打开
                if (door && door.userData.isOpen) {
                    const adjacentRoom = this.rooms.get(conn.targetRoom);
                    if (adjacentRoom) {
                        adjacentRoom.result.group.visible = true;
                    }
                }
            }
        }
    }

    /**
     * 检测角色是否在门口附近，触发房间切换
     * 如果门未打开，会自动打开门
     * @param {THREE.Vector3} charPos - 角色世界坐标
     * @returns {string|null} 切换到的房间 ID，或 null（未切换）
     */
    checkDoorTransition(charPos) {
        const room = this.getCurrentRoom();
        if (!room || !room.connections) return null;

        // 每帧更新可见性（门开合后相邻房间会显示/隐藏）
        this.updateVisibility();

        for (const conn of room.connections) {
            const dx = charPos.x - conn.doorPos.x;
            const dz = charPos.z - conn.doorPos.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist < DOOR_DETECT_RADIUS) {
                const door = room.result.door;
                console.log(`[Door] 角色在门口附近 dist=${dist.toFixed(2)}, door=${door ? 'exists' : 'null'}, isOpen=${door?.userData.isOpen}`);

                // 自动开门
                if (door && !door.userData.isOpen) {
                    door.userData.isOpen = true;
                    door.userData.targetRotation = Math.PI / 2;
                    this.updateVisibility(); // 立即更新可见性
                    console.log('[Door] 自动开门');
                }

                // 切换房间
                if (door && door.userData.isOpen) {
                    console.log(`[Door] 切换房间: ${room.id} → ${conn.targetRoom}`);
                    this.switchRoom(conn.targetRoom, charPos);
                    return conn.targetRoom;
                }
            }
        }
        return null;
    }

    /**
     * 检查指定位置附近的门是否打开
     * @private
     */
    _isDoorOpenAt(room, doorWorldPos) {
        const door = room.result.door;
        if (!door) return true; // 没有门也允许通过（比如中央走廊北侧）

        // 直接检查门的 isOpen 状态
        return door.userData.isOpen === true;
    }

    /**
     * 获取当前房间的门引用
     * @returns {THREE.Group|null}
     */
    getCurrentDoor() {
        const room = this.getCurrentRoom();
        return room ? room.result.door : null;
    }

    /**
     * 获取当前房间的窗帘引用
     * @returns {THREE.Group|null}
     */
    getCurrentCurtains() {
        const room = this.getCurrentRoom();
        return room ? room.result.curtains : null;
    }

    /**
     * 获取当前房间的天花板灯引用
     * @returns {THREE.Group|null}
     */
    getCurrentCeilingLight() {
        const room = this.getCurrentRoom();
        return room ? room.result.ceilingLight : null;
    }

    /**
     * 获取当前房间的落地灯引用
     * @returns {THREE.Group|null}
     */
    getCurrentFloorLamp() {
        const room = this.getCurrentRoom();
        return room ? room.result.floorLamp : null;
    }

    /**
     * 获取当前房间的家具列表（供寻路使用）
     * @returns {THREE.Object3D[]}
     */
    getCurrentFurniture() {
        const room = this.getCurrentRoom();
        if (!room) return [];
        return room.result.furniture.map(f => f.group);
    }

    /**
     * 获取当前房间的 allMovables（供拖拽使用）
     * @returns {THREE.Object3D[]}
     */
    getCurrentMovables() {
        const room = this.getCurrentRoom();
        if (!room) return [];
        return room.result.allMovables;
    }

    /**
     * 获取当前房间的小物品列表
     * @returns {THREE.Group[]}
     */
    getCurrentSmallItems() {
        const room = this.getCurrentRoom();
        if (!room) return [];
        return room.result.smallItems;
    }
}
