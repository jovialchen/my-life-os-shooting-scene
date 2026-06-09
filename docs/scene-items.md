# 场景物品清单

> 自动生成于 2026-06-09，基于 `js/main.js` 及各模块源码整理。

---

## 一、房间结构（不可移动，不在侧边栏）

**文件：** `js/room/room.js`

| 物体 | 说明 |
|------|------|
| 地板 | PlaneGeometry，`matFloor`，接收阴影 |
| 天花板 | PlaneGeometry，`matCeiling` |
| 后墙 | PlaneGeometry，z = -ROOM_DEPTH/2 |
| 左墙 | PlaneGeometry，x = -ROOM_WIDTH/2 |
| 右墙 | PlaneGeometry，x = +ROOM_WIDTH/2 |

---

## 二、窗户（不可移动，不在侧边栏）

**文件：** `js/room/window.js` — `createWindow()`

右墙上的大窗户，包含：窗框（上下左右四根框条）、玻璃面板、十字窗棂（横竖两根）、窗台。不可拖拽。

---

## 三、可交互物品总览

### 家具类

| 中文名 | 英文标识 | 文件 | 表面类型 | 可拖拽 | 特殊属性 | 默认位置 |
|--------|----------|------|----------|--------|----------|----------|
| 三人沙发 | sofa | `js/furniture/sofa.js` | floor | ✅ | 寻路障碍物 | x=-1.5, z=0.5, 旋转90° |
| 单人椅 | chair | `js/furniture/chair.js` | floor | ✅ | 寻路障碍物 | x=1.8, z=1.2, 旋转-45° |
| 圆形茶几 | coffeeTable | `js/furniture/coffeeTable.js` | floor | ✅ | 寻路障碍物 | x=0.3, z=1.5 |
| 圆形边桌 | sideTable | `js/furniture/sideTable.js` | floor | ✅ | 寻路障碍物 | x=-3.0, z=-1.8 |
| 落地灯 | floorLamp | `js/furniture/floorLamp.js` | floor | ✅ | 寻路障碍物，含 PointLight | x=2.5, z=-1.5 |
| 三层书架 | bookshelf | `js/furniture/bookshelf.js` | floor | ✅ | 寻路障碍物 | x=1.0, z=-ROOM_DEPTH/2+0.2 |

### 装饰类

| 中文名 | 英文标识 | 文件 | 表面类型 | 可拖拽 | 特殊属性 | 默认位置 |
|--------|----------|------|----------|--------|----------|----------|
| 装饰画 | wallArt | `js/room/decorations.js` | wall-left | ✅ | `crossWall=true`，可在墙面间切换 | 左墙, y=2.0, z=-1.0 |
| 地毯 | rug | `js/room/decorations.js` | floor | ✅ | — | x=0, y=0.005, z=0.5 |
| 窗帘 | curtains | `js/room/window.js` | wall-right | ❌ | 点击切换开合动画 | 右墙, x=ROOM_WIDTH/2-0.05 |

### 小物品类（`movableType: 'small-item'`）

小物品可放置在任意表面上，松开时自动向下 raycast 吸附到最近的平面。

| 中文名 | 英文标识 | 文件 | 可拖拽 | 默认位置 |
|--------|----------|------|--------|----------|
| 窗台盆栽 | plant | `js/room/window.js` | ✅ | 窗台, x=ROOM_WIDTH/2-0.1, y=0.28, z=0.3 |
| 边桌书本 | sideTableBook | `js/furniture/sideTable.js` | ✅ | 边桌面上, y=0.7 |
| 靠枕（金） | cushion[0] | `js/furniture/sofa.js` | ✅ | 沙发左侧, 旋转z=0.15 |
| 靠枕（绿） | cushion[1] | `js/furniture/sofa.js` | ✅ | 沙发右侧, 旋转z=-0.1 |
| 书架书本 1~N | shelfBooks[] | `js/furniture/bookshelf.js` | ✅ | 书架各层, 9~15本随机生成 |

### 角色

| 中文名 | 英文标识 | 文件 | 可拖拽 | 特殊属性 | 默认位置 |
|--------|----------|------|--------|----------|----------|
| 小人 | humanoid | `js/character/humanoid.js` | ✅ | VRM 角色，点击地面可寻路行走，避障家具 | x=1.5, z=0.3, 旋转-0.4 |

---

## 四、拖拽属性说明

| 属性 | 含义 |
|------|------|
| `surface: 'floor'` | 沿地面 y=0 平面拖拽（x, z 方向） |
| `surface: 'wall-left'` | 沿左墙平面拖拽（y, z 方向） |
| `surface: 'wall-right'` | 沿右墙平面拖拽（y, z 方向） |
| `surface: 'wall-back'` | 沿后墙平面拖拽（x, y 方向） |
| `crossWall: true` | 拖拽到角落时自动切换到相邻墙面，松开时吸附到最近墙面并旋转朝向 |
| `movableType: 'small-item'` | 拖拽时跟随鼠标放置在任意表面，松开时向下 raycast 吸附到最近平面 |

---

## 五、侧边栏分类

| 分类 | 物品 |
|------|------|
| 家具 | 三人沙发、单人椅、圆形茶几、圆形边桌、落地灯、三层书架 |
| 挂画 | 装饰画 |
| 小物品 | 窗台盆栽、边桌书本、靠枕（金）、靠枕（绿）、书架书本 1~N |
| 窗帘 | 窗帘 |
| 地毯 | 地毯 |
| 角色 | 小人 |

---

## 六、寻路障碍物

以下家具参与 A* 寻路避障（`js/character/pathfinding.js`）：

- 三人沙发
- 单人椅
- 圆形茶几
- 圆形边桌
- 落地灯
- 三层书架

---

## 七、灯光系统

**文件：** `js/main.js`（直接创建，无独立模块）

| 灯光 | 类型 | 说明 |
|------|------|------|
| 环境光 | AmbientLight | 柔和暖色基底 |
| 主方向光 | DirectionalLight | 模拟夕阳从窗户照入，带阴影 |
| 落地灯 | PointLight | 随落地灯移动，暖黄色，距离6 |

---

## 八、未使用代码

| 函数 | 文件 | 说明 |
|------|------|------|
| `createLightCone()` | `js/room/window.js` | 已导出但未在 `main.js` 中导入使用，模拟窗户体积光的半透明锥体 |
