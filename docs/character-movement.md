# 角色移动系统文档

> 最后更新：2026-06-09

## 目录

1. [系统概览](#1-系统概览)
2. [涉及文件](#2-涉及文件)
3. [核心数据流](#3-核心数据流)
4. [点击寻路流程](#4-点击寻路流程)
5. [A* 寻路算法](#5-a-寻路算法)
6. [逐帧移动逻辑](#6-逐帧移动逻辑)
7. [程序化走路动画](#7-程序化走路动画)
8. [卡住检测与重新寻路](#8-卡住检测与重新寻路)
9. [家具拖拽与网格重建](#9-家具拖拽与网格重建)
10. [常量参数速查表](#10-常量参数速查表)
11. [系统交互图](#11-系统交互图)

---

## 1. 系统概览

角色移动是一个 **点击→寻路→行走** 的系统，无物理引擎，核心特点：

- **A\* 网格寻路**：在房间地板上覆盖 80×70 的 2D 网格（0.1m 分辨率），标记家具为障碍物，用 A\* 规划最短路径
- **路径平滑**：用 line-of-sight 贪心算法删减冗余路径点
- **逐帧移动**：每帧沿路径点方向转向 + 前进，带可行走校验
- **程序化动画**：不使用外部 .vrma 文件，走路动画完全由代码驱动骨骼旋转
- **动态避障**：家具被拖拽后自动重建网格，正在走路的角色会重新寻路

---

## 2. 涉及文件

| 文件 | 职责 |
|------|------|
| [walker.js](js/character/walker.js) | 移动控制器：输入处理、移动循环、程序化走路动画 |
| [pathfinding.js](js/character/pathfinding.js) | A\* 寻路：网格构建、路径搜索、路径平滑、可行走检测 |
| [humanoid.js](js/character/humanoid.js) | VRM 模型加载、骨骼初始化（提供 walker.js 操作的骨架） |
| [dragControls.js](js/interaction/dragControls.js) | 拖拽系统：物体拖拽移动，松手时触发网格重建 |
| [config.js](js/config.js) | 共享常量：房间尺寸、点击/拖拽判定阈值 |
| [main.js](js/main.js) | 总线：组装各模块、运行动画循环 |

---

## 3. 核心数据流

```
用户点击地面
    │
    ▼
walker.js:pointerup
    ├── 射线检测 → 是否点到家具/角色？→ 是 → 停止走路
    ├── 射线与 y=0 平面求交 → 得到点击世界坐标
    ├── clampToRoomWorld() → 限制在房间内
    ├── isWalkableWorld() → 点击位置是否可行走？
    ├── findPath(当前位置, 点击位置) → A* 路径
    ├── smoothPath(路径) → 平滑后的路径点
    └── state='walking', 存储 waypoints

每帧 animate() 循环:
    updateWalker(delta)
        ├── updateMovement(delta)   ← 仅 state='walking' 时
        │     ├── 卡住检测
        │     ├── 路径点到达判定
        │     └── moveToward() → 转向 + 前进 + 可行走校验
        └── updateWalkAnimation(delta) ← 始终运行
              ├── 混合权重插值 (idle ↔ walk)
              └── 程序化骨骼驱动 (腿/臂/臀/脊椎)
```

---

## 4. 点击寻路流程

`initWalker()` 中注册的 `pointerup` 事件处理（walker.js:132-199）：

1. **区分点击与拖拽**：记录 pointerdown 位置，pointerup 时计算移动距离，超过 `CLICK_DRAG_THRESHOLD`（5px）则视为拖拽，忽略
2. **射线检测物体**：先对所有 blocker（家具 mesh、角色 mesh）做 raycast，如果命中则停止走路并返回
3. **地面求交**：射线与 `y=0` 平面求交，得到世界坐标
4. **边界钳制**：`clampToRoomWorld(hit.x, hit.z)` 将坐标限制在离墙 ≥ 0.35m 的区域内
5. **可行走校验**：`isWalkableWorld()` 检查目标点是否在障碍物上
6. **A\* 寻路**：`findPath(当前位置, 目标点)` 返回路径点数组或 null
7. **路径平滑**：`smoothPath(path)` 用 line-of-sight 删减中间点
8. **末段优化**：尝试用实际点击位置替换最后一个路径点（如果直线可达）
9. **启动行走**：`state = 'walking'`，存储 waypoints，在目标处显示黄色圆环标记

---

## 5. A* 寻路算法

### 5.1 网格构建 — `buildGrid(furnitureList)`

**参数**（pathfinding.js:11-14）：

| 参数 | 值 | 说明 |
|------|-----|------|
| `CELL_SIZE` | 0.1m | 网格分辨率 |
| `CHAR_RADIUS` | 0.25m | 角色碰撞半径（膨胀量） |
| `OBSTACLE_PAD` | 0.05m | 家具额外边距 |
| `WALL_MARGIN` | 0.35m | 离墙最小距离 |

**网格尺寸**：80 列 × 70 行，原点在 `(-4, -3.5)`

**构建步骤**：
1. 清零所有格子（`Uint8Array`，0=可通行，1=障碍）
2. 遍历每个可见家具，计算世界坐标 AABB，膨胀 `CHAR_RADIUS + OBSTACLE_PAD`，标记覆盖的格子为障碍
3. 四面墙各标记 `WALL_MARGIN` 宽的边框为障碍

### 5.2 A* 搜索 — `findPath(start, end)`

- **8 方向移动**：上下左右 + 四个对角
- **移动代价**：正交 1.0，对角 1.414（√2）
- **对角穿墙防护**：对角移动时检查两个正交邻居是否都可通行
- **启发函数**：Octile 距离 = `max(dx,dz) + (√2-1) * min(dx,dz)`
- **起点/终点在障碍内**：`findNearestFree()` 在半径 10 格内搜索最近可通行格
- **性能优化**：预分配 `gScoreBuf`、`cameFromBuf`、`closedBuf`（`Float32Array`/`Int32Array`/`Uint8Array`），避免 GC 压力
- **开放集**：自实现 `MinHeap`（最小堆）
- **返回值**：`THREE.Vector3[]`（世界坐标路径点），或 `null`（不可达）

### 5.3 路径平滑 — `smoothPath(path)`

贪心 line-of-sight 简化：

```
从第一个点开始，找最远的"可见"点，跳过中间所有点。
"可见"用 hasLineOfSight() 判断：Bresenham 遍历路径上的格子，
同时检查行进方向两侧各 1 格（为角色半径留空间）。
```

---

## 6. 逐帧移动逻辑

### 6.1 状态机

两个状态（walker.js:52）：

| 状态 | 含义 |
|------|------|
| `idle` | 静止，等待点击 |
| `walking` | 正在沿路径行走 |

模块级变量：
- `targetPos`：最终目标位置（Vector3）
- `waypoints`：路径点队列（Vector3[]）
- `stuckCounter` / `prevDistance`：卡住检测

### 6.2 移动更新 — `updateMovement(delta)`

每帧调用（walker.js:305-393）：

1. **取当前路径点**：`waypoints[0]` 作为子目标
2. **路径点全部走完**：
   - 与最终目标距离 < `targetThreshold`（0.15m）→ 到达，结束
   - 否则尝试直接走向最终目标
3. **卡住检测**：见[第 8 节](#8-卡住检测与重新寻路)
4. **到达判定**：与当前路径点距离 < `arriveThreshold`（0.08m）→ `waypoints.shift()`，取下一个
5. **调用 `moveToward()`**

### 6.3 单步移动 — `moveToward(target, delta)`

walker.js:399-430：

1. **转向**：
   - 用 `atan2` 计算目标方向角
   - 与当前朝向求差值，归一化到 `[-π, π]`
   - 按 `rotSpeed * delta`（6.0 rad/s）插值旋转
2. **前进**：
   - 步长 = `min(speed * delta, 剩余距离)`（speed = 1.2 m/s）
   - 计算新 X/Z 位置
3. **可行走校验**：`isWalkableWorld(newX, newZ)` → 不可行走则原地等待
4. **边界钳制**：`clampToRoomWorld()` 确保不离开房间

---

## 7. 程序化走路动画

不使用外部动画文件，完全由代码驱动 VRM 骨骼（walker.js:444-524）。

### 7.1 动画参数

| 参数 | 值 | 说明 |
|------|-----|------|
| `frequency` | 4.5 | 步频（越大步子越快） |
| `legSwing` | 0.5 rad | 腿部前后摆幅 |
| `kneeBend` | 1.1 rad | 膝盖弯曲幅度 |
| `armSwing` | 0.35 rad | 手臂摆幅 |
| `armBend` | 0.2 rad | 手臂弯曲 |
| `bodyBob` | 0.02m | 身体上下起伏 |
| `spineTwist` | 0.04 rad | 脊椎左右扭转 |
| `blendSpeed` | 8.0 | idle↔walk 过渡速度 |

### 7.2 受影响骨骼

```
hips, spine,
leftUpperLeg, leftLowerLeg, rightUpperLeg, rightLowerLeg,
leftUpperArm, leftLowerArm, rightUpperArm, rightLowerArm
```

### 7.3 动画逻辑 — `updateWalkAnimation(delta)`

1. **混合权重**：`walkBlend` 在 0（idle）和 1（walk）之间按 `blendSpeed * delta` 插值
2. **相位推进**：`walkPhase += delta * frequency`，范围 `[0, 2π)`
3. **腿部**：
   - 左右上腿以 `sin(walkPhase)` 反相摆动
   - 下腿仅在前摆阶段弯曲：`max(0, ±sin) * kneeBend`
4. **手臂**：与对侧腿同步（自然步态），下臂保持常量前弯
5. **身体起伏**：`|sin| * bodyBob` 叠加到 hips 的 Y 位置
6. **脊椎扭转**：`sin * spineTwist` 叠加到 spine 的 Y 旋转
7. **静止恢复**：当 `walkBlend < 0.01` 且 `state === 'idle'` 时，调用 `resetPose()` 恢复所有骨骼到默认站姿

### 7.4 初始站姿 — `applyIdlePose()`

VRM 加载后将 T-pose 调整为自然站姿（walker.js:286-303）：

- **上臂**：`rotation.z = ±1.3`（约外展 20°，非完全贴身）
- **下臂**：`rotation.x = -0.35`（肘部自然弯曲）

此姿态保存为 `boneDefaults`，作为走路动画的基准值。

---

## 8. 卡住检测与重新寻路

当角色连续 **30 帧**（`stuckFrames`）前进距离不足 **0.01m**（`stuckMinDist`）时触发：

1. 从当前位置重新 `findPath()` 到最终目标
2. 平滑新路径
3. 如果重新寻路成功 → 替换 waypoints，重置卡住计数
4. 如果重新寻路失败 → `finishWalking()`，停止走路

---

## 9. 家具拖拽与网格重建

### 9.1 拖拽系统

[dragControls.js](js/interaction/dragControls.js) 处理所有物体的拖拽，包括角色本身：

- 地面物体沿 `y=0` 平面移动
- 墙面物体沿对应墙面移动
- 小物品通过向下 raycast 吸附到最近表面
- 松手时调用 `options.onDrop` 回调

### 9.2 网格重建 — `rebuildNavGrid()`

walker.js:224-246，作为 `onDrop` 回调注册：

1. `buildGrid(furnitureList)` — 用家具最新位置重建障碍网格
2. 如果角色正在走路 → 从**当前位置**重新寻路到原目标
3. 新路径不可达 → `finishWalking()`

---

## 10. 常量参数速查表

### 移动参数（walker.js:WALK）

| 参数 | 值 | 说明 |
|------|-----|------|
| `speed` | 1.2 m/s | 移动速度 |
| `rotSpeed` | 6.0 rad/s | 转向速度 |
| `arriveThreshold` | 0.08m | 路径点到达判定距离 |
| `targetThreshold` | 0.15m | 最终目标到达判定距离 |
| `floorY` | 0.01 | 射线检测地板的 y 值 |
| `wallMargin` | 0.35m | 离墙最小距离 |
| `stuckFrames` | 30 | 卡住检测帧数阈值 |
| `stuckMinDist` | 0.01m | 卡住检测最小移动距离 |

### 寻路参数（pathfinding.js）

| 参数 | 值 | 说明 |
|------|-----|------|
| `CELL_SIZE` | 0.1m | 网格分辨率 |
| `CHAR_RADIUS` | 0.25m | 角色碰撞半径 |
| `OBSTACLE_PAD` | 0.05m | 家具额外边距 |
| `WALL_MARGIN` | 0.35m | 离墙最小距离 |
| `GRID_W` | 80 | 网格列数 |
| `GRID_D` | 70 | 网格行数 |

### 房间尺寸（config.js）

| 参数 | 值 |
|------|-----|
| `ROOM_WIDTH` | 8m |
| `ROOM_DEPTH` | 7m |
| `ROOM_HALF_W` | 4m |
| `ROOM_HALF_D` | 3.5m |
| `CLICK_DRAG_THRESHOLD` | 5px |

### 角色初始位置（humanoid.js）

| 参数 | 值 |
|------|-----|
| `posX` | 1.5 |
| `posY` | 0 |
| `posZ` | 0.3 |
| `rotY` | -0.4 rad |

---

## 11. 系统交互图

```
┌─────────────┐     pointerup      ┌──────────────┐
│   用户点击   │ ──────────────────→ │  walker.js   │
│   地面       │                     │  输入处理     │
└─────────────┘                     └──────┬───────┘
                                           │
                    ┌──────────────────────┼──────────────────────┐
                    ▼                      ▼                      ▼
            ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
            │ pathfinding  │     │  raycaster   │     │  config.js   │
            │ findPath()   │     │  地面求交     │     │  房间边界     │
            │ smoothPath() │     │  物体检测     │     │  阈值常量     │
            └──────┬───────┘     └──────────────┘     └──────────────┘
                   │
                   ▼
            waypoints[] ──→ 每帧 updateMovement()
                                │
                                ▼
                         moveToward()
                          ├── 转向 (rotSpeed)
                          ├── 前进 (speed)
                          └── isWalkableWorld() 校验

┌─────────────┐     拖拽松手     ┌──────────────┐
│  dragControls│ ──────────────→ │ walker.js    │
│  家具移动    │   onDrop 回调    │ rebuildNavGrid│
└─────────────┘                  └──────┬───────┘
                                        │
                                        ▼
                                 buildGrid() 重建网格
                                 findPath() 重新寻路

┌─────────────┐                     ┌──────────────┐
│ main.js     │ 每帧调用            │  walker.js   │
│ animate()   │ ──────────────────→ │ updateWalker │
│             │                     │   ├── updateMovement()
│             │                     │   └── updateWalkAnimation()
└─────────────┘                     └──────────────┘
```
