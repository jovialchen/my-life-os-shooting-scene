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
        /** @type {object|null} 走廊边界 {minX, maxX, minZ, maxZ} */
        this.corridorBounds = null;
        /** @type {Map<string, THREE.Group>} roomId → 走廊面门墙引用 */
        this.corridorDoorWalls = new Map();
        /** @type {THREE.Group} 门墙独立组（从房间 group 中拆出，可独立控制可见性） */
        this.doorWallsGroup = new THREE.Group();
        /** @type {THREE.Group|null} 走廊 group 引用 */
        this._corridorGroup = null;
        /** @type {THREE.Mesh|null} 走廊地板 */
        this._corridorFloor = null;
        /** @type {THREE.Mesh|null} 走廊天花板 */
        this._corridorCeiling = null;
        /** @type {THREE.Group|null} 走廊西墙（出口门） */
        this._corridorWestWall = null;
        /** @type {THREE.Group|null} 走廊东墙 */
        this._corridorEastWall = null;
    }

    /**
     * 设置走廊边界（用于角色检测）
     */
    setCorridorBounds(bounds) {
        this.corridorBounds = bounds;
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
     * 支持 'corridor' 作为虚拟目标（走廊不在 rooms map 中）
     */
    addConnection(fromRoomId, toRoomId, doorWorldPos) {
        const from = this.rooms.get(fromRoomId);
        const to = this.rooms.get(toRoomId);

        if (from) {
            from.connections.push({ targetRoom: toRoomId, doorPos: doorWorldPos });
        }
        if (to) {
            to.connections.push({ targetRoom: fromRoomId, doorPos: doorWorldPos });
        }
    }

    /**
     * 构建所有房间并添加到场景
     */
    build(scene, initialRoomId) {
        this.scene = scene;

        for (const [, room] of this.rooms) {
            scene.add(room.result.group);
        }

        // 将门墙从房间 group 拆出，放入独立的 doorWallsGroup
        scene.add(this.doorWallsGroup);
        this._extractCorridorDoorWalls();

        this.currentRoomId = initialRoomId;
        this.updateVisibility();
    }

    /**
     * 将每间房的走廊面门墙从房间 group 拆出，移入 doorWallsGroup
     * 这样门墙的可见性可以独立于房间 group 控制
     */
    _extractCorridorDoorWalls() {
        for (const [id, room] of this.rooms) {
            const conn = room.connections.find(c => c.targetRoom === 'corridor');
            if (!conn) continue;

            // 判断走廊在房间的哪一侧
            const corridorFacing = conn.doorPos.z > room.position.z ? 'north' : 'south';

            // 找到门墙
            const doorWall = room.result.group.children.find(
                child => child.userData?.wallFacing === corridorFacing
            );
            if (doorWall) {
                // 先计算世界坐标（相对于 scene）
                const worldPos = new THREE.Vector3();
                const worldQuat = new THREE.Quaternion();
                doorWall.getWorldPosition(worldPos);
                doorWall.getWorldQuaternion(worldQuat);

                // 从房间 group 移到 doorWallsGroup
                room.result.group.remove(doorWall);
                this.doorWallsGroup.add(doorWall);

                // 用世界坐标设置位置（doorWallsGroup 在 scene 原点，无偏移）
                doorWall.position.copy(worldPos);
                doorWall.quaternion.copy(worldQuat);

                this.corridorDoorWalls.set(id, doorWall);
            }
        }
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
     * @returns {string|null} 房间 ID，或 'corridor'（走廊）
     */
    detectCurrentRoom(charPos) {
        for (const [id, room] of this.rooms) {
            const p = room.position;
            const hw = room.bounds.halfW;
            const hd = room.bounds.halfD;
            if (charPos.x >= p.x - hw && charPos.x <= p.x + hw &&
                charPos.z >= p.z - hd && charPos.z <= p.z + hd) {
                return id;
            }
        }
        // 检查走廊
        if (this.corridorBounds) {
            const b = this.corridorBounds;
            if (charPos.x >= b.minX && charPos.x <= b.maxX &&
                charPos.z >= b.minZ && charPos.z <= b.maxZ) {
                return 'corridor';
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
     * 进入走廊：走廊全部 + 所有房间门墙 + 开门房间全貌
     */
    _showCorridorView() {
        // 走廊全部显示
        this._setCorridorVisible();

        // 所有门墙显示
        this.doorWallsGroup.visible = true;
        for (const [, doorWall] of this.corridorDoorWalls) {
            doorWall.visible = true;
        }

        // 所有房间：保留墙体+天花板可见，隐藏家具等
        for (const [, r] of this.rooms) {
            this._showWallsAndCeilingsOnly(r);
        }

        // 开门的房间 → 全部显示（恢复所有子元素）
        for (const [id, r] of this.rooms) {
            const doorWall = this.corridorDoorWalls.get(id);
            if (doorWall && doorWall.userData.isOpen) {
                r.result.group.visible = true;
                r.result.group.traverse(child => {
                    if (child.isMesh) child.visible = true;
                });
            }
        }
    }

    /**
     * 进入房间：当前房间全部 + 走廊地板
     */
    _showRoomView() {
        const room = this.getCurrentRoom();
        if (!room) return;

        // 走廊：只显示地板（隐藏墙、天花板）
        this._setCorridorVisible();

        // 非当前房间：只保留墙体+天花板可见
        for (const [, r] of this.rooms) {
            if (r.id !== this.currentRoomId) {
                this._showWallsAndCeilingsOnly(r);
            }
        }

        // 当前房间：全部显示
        room.result.group.visible = true;
        room.result.group.traverse(child => {
            if (child.isMesh) child.visible = true;
        });

        // 门墙：始终全部显示（遮挡透明由 wallOcclusion 系统处理）
        for (const [, doorWall] of this.corridorDoorWalls) {
            doorWall.visible = true;
        }
    }

    /**
     * 只显示房间的墙体和天花板，隐藏家具/装饰等
     * @param {object} room
     */
    _showWallsAndCeilingsOnly(room) {
        room.result.group.visible = true;
        for (const child of room.result.group.children) {
            child.visible = !!(child.userData?.isWall || child.userData?.isOccluder);
        }
    }

    /**
     * 控制走廊部件可见性
     * 地板、天花板、墙体始终显示（遮挡透明由 wallOcclusion 系统处理）
     */
    _setCorridorVisible() {
        if (this._corridorFloor)    this._corridorFloor.visible = true;
        if (this._corridorCeiling)  this._corridorCeiling.visible = true;
        if (this._corridorWestWall) this._corridorWestWall.visible = true;
        if (this._corridorEastWall) this._corridorEastWall.visible = true;
    }

    /**
     * 更新房间可见性
     */
    updateVisibility() {
        if (this.currentRoomId === 'corridor') {
            this._showCorridorView();
        } else {
            this._showRoomView();
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
