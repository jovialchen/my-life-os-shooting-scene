/**
 * 公寓管理器
 *
 * 管理所有房间的构建、可见性、门状态
 * 角色通过统一寻路网格直接跨房间行走，不使用传送
 */
import * as THREE from 'three';
import { buildRoom } from './elements/index.js';


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
        /** @type {Function|null} 当前房间变化回调（用于更新 UI 引用） */
        this.onRoomChange = null;
    }

    /**
     * 注册一个房间
     */
    addRoom(id, config, position) {
        const result = buildRoom(config);
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
     */
    build(scene, initialRoomId) {
        this.scene = scene;

        for (const [, room] of this.rooms) {
            scene.add(room.result.group);
        }

        this.currentRoomId = initialRoomId;
        this.updateVisibility();
    }

    /**
     * 获取当前房间数据
     */
    getCurrentRoom() {
        return this.rooms.get(this.currentRoomId) || null;
    }

    /**
     * 根据角色位置检测当前所在房间
     * @param {THREE.Vector3} charPos
     * @returns {string|null} 房间 ID
     */
    detectCurrentRoom(charPos) {
        for (const [id, room] of this.rooms) {
            if (!room.result.group.visible) continue;
            const p = room.position;
            const hw = room.bounds.halfW;
            const hd = room.bounds.halfD;
            if (charPos.x >= p.x - hw && charPos.x <= p.x + hw &&
                charPos.z >= p.z - hd && charPos.z <= p.z + hd) {
                return id;
            }
        }
        return null;
    }

    /**
     * 更新当前房间 ID（基于角色位置）
     * @param {THREE.Vector3} charPos
     * @returns {boolean} 是否切换了房间
     */
    updateCurrentRoom(charPos) {
        const newRoomId = this.detectCurrentRoom(charPos);
        if (newRoomId && newRoomId !== this.currentRoomId) {
            const prevRoomId = this.currentRoomId;
            this.currentRoomId = newRoomId;
            this.updateVisibility();

            // 触发回调
            if (this.onRoomChange) {
                this.onRoomChange(newRoomId, prevRoomId);
            }
            return true;
        }
        return false;
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
                const adjacentRoom = this.rooms.get(conn.targetRoom);
                if (!adjacentRoom) continue;

                if (door) {
                    if (door.userData.isOpen) {
                        adjacentRoom.result.group.visible = true;
                    }
                } else {
                    const adjDoor = adjacentRoom.result.door;
                    if (!adjDoor || adjDoor.userData.isOpen) {
                        adjacentRoom.result.group.visible = true;
                    }
                }
            }
        }
    }

    /**
     * 根据角色位置更新当前房间（每帧调用）
     * @param {THREE.Vector3} charPos
     */
    updateCurrentRoomByPos(charPos) {
        this.updateCurrentRoom(charPos);
    }

    /**
     * 获取当前房间边界（供其他模块使用）
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
     * 获取当前房间的门引用
     */
    getCurrentDoor() {
        const room = this.getCurrentRoom();
        return room ? room.result.door : null;
    }

    /**
     * 获取当前房间的窗帘引用
     */
    getCurrentCurtains() {
        const room = this.getCurrentRoom();
        return room ? room.result.curtains : null;
    }

    /**
     * 获取当前房间的天花板灯引用
     */
    getCurrentCeilingLight() {
        const room = this.getCurrentRoom();
        return room ? room.result.ceilingLight : null;
    }

    /**
     * 获取当前房间的落地灯引用
     */
    getCurrentFloorLamp() {
        const room = this.getCurrentRoom();
        return room ? room.result.floorLamp : null;
    }

    /**
     * 获取当前房间的家具列表
     */
    getCurrentFurniture() {
        const room = this.getCurrentRoom();
        if (!room) return [];
        return room.result.furniture.map(f => f.group);
    }

    /**
     * 获取当前房间的 allMovables
     */
    getCurrentMovables() {
        const room = this.getCurrentRoom();
        if (!room) return [];
        return room.result.allMovables;
    }

    /**
     * 获取当前房间的小物品列表
     */
    getCurrentSmallItems() {
        const room = this.getCurrentRoom();
        if (!room) return [];
        return room.result.smallItems;
    }
}
