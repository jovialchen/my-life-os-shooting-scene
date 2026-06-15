# 小物品与家具设计文档

> Hazel's LifeOS Studio — 场景物品系统完整设计说明

---

## 一、项目概述

Hazel's LifeOS Studio 是一个基于 Three.js 的 3D 公寓生活沙盒应用。所有物品**不使用外部模型文件**，而是通过 Three.js 基础几何体（Box、Cylinder、Sphere、Cone、Plane）**程序化拼装**而成，设计风格深受**宜家北欧风**影响。

**技术栈：**
- Three.js r170（ES module import maps）
- @pixiv/three-vrm 3.5.3（VRM 角色加载）
- Vanilla JavaScript（无框架、无打包工具）
- 后处理：EffectComposer + UnrealBloomPass
- Tone mapping：ACES Filmic

---

## 二、家具清单（6 种）

定义于 `js/elements/furniture.js`。

### 1. 三人沙发（Sofa）

- **造型**：方形底座 + 靠背 + 两个扶手 + 4 圆柱腿
- **尺寸**：底座 2.4 × 0.4 × 0.9m，靠背 2.4 × 0.7 × 0.15m，扶手 0.15 × 0.5 × 0.9m
- **材质**：青绿色面料（0x0097a7，灵感来自 IKEA KIVIK）+ 桦木色腿（0xdeb887）
- **行为**：地面放置、可拖拽、寻路障碍

### 2. 单人椅（Chair）

- **造型**：座面 + 靠背 + 4 圆柱腿
- **尺寸**：座面 0.6 × 0.06 × 0.55m，靠背 0.6 × 0.6 × 0.06m
- **材质**：亮黄色面料（0xffda00，灵感来自 IKEA POANG）+ 桦木色腿
- **行为**：地面放置、可拖拽、寻路障碍

### 3. 圆形茶几（Coffee Table）

- **造型**：圆柱桌面 + 3 根金属腿（三角排列）
- **尺寸**：桌面半径 0.55m，厚度 0.05m，32 段圆
- **材质**：桦木桌面 + 深灰金属腿（0x2a2a2a，metalness 0.8）
- **行为**：地面放置、可拖拽、寻路障碍

### 4. 圆形边桌（Side Table）

- **造型**：圆柱桌面 + 中央单腿 + 圆形底座
- **尺寸**：桌面半径 0.3m，底座半径 0.18m
- **材质**：桦木桌面 + 金属腿和底座
- **行为**：地面放置、可拖拽、寻路障碍

### 5. 三层书架（Bookshelf）

- **造型**：两侧板 + 4 层隔板（含顶底）+ 背板
- **尺寸**：1.2m 宽 × 2.0m 高 × 0.35m 深，3 层搁架
- **材质**：桦木框架 + 冷白背板（0xf4f8fa）
- **行为**：地面放置、可拖拽、寻路障碍。书架上的书本为子物体，随书架一起移动
- **特殊**：每层自动生成 3-5 本书（共 9-15 本），随机宽度/高度

### 6. 落地灯（Floor Lamp）

- **造型**：圆形金属底座 + 长杆 + 锥形灯罩 + PointLight 光源
- **尺寸**：底座半径 0.2m，杆高 1.7m，灯罩半径 0.25m
- **材质**：金属杆 + 半透明白色灯罩（opacity 0.85）
- **灯光**：暖黄色 PointLight（0xffcc77），强度 1.5，距离 6，带阴影（512px）
- **行为**：地面放置、可拖拽、寻路障碍、点击切换开关

---

## 三、小物品清单（3 种）

定义于 `js/elements/smallItems.js`。

### 1. 盆栽（Plant）

- **造型**：圆柱花盆 + 5 个球形叶片环绕排列
- **尺寸**：花盆上半径 0.08m、下半径 0.06m、高 0.12m
- **材质**：白陶盆（0xf5f5f0）+ 海绿叶（0x2e8b57）
- **旋转约束**：`horizontal`（只能水平旋转，不可垂直翻转）
- **放置**：可吸附到任何表面（向下 raycast）

### 2. 抱枕（Cushion）

- **造型**：方块体
- **尺寸**：0.4 × 0.4 × 0.15m
- **材质**：珊瑚红（0xf06060）或亮黄色（0xffda00）
- **旋转约束**：`horizontal`
- **放置**：通常放在沙发上，使用 `relPos` 相对坐标定位

### 3. 书本（Book）

- **造型**：扁长方体
- **尺寸**：默认 0.15 × 0.06 × 0.2m（宽 × 高 × 深），可随机化
- **材质**：随机蓝（0x0058a3）/ 黄（0xffda00）/ 红（0xe74c3c）三色
- **状态**：`standing`（立放）或 `laying`（平放，X 轴旋转 90°）
- **旋转约束**：`any`（水平 + 垂直均可，R 键翻转）
- **特殊**：`bookshelfBooks` 类型自动在书架每层生成 3-5 本书

---

## 四、装饰清单（2 种）

定义于 `js/elements/decoration.js`。

### 1. 地毯（Rug）

- **造型**：平面
- **尺寸**：默认 3.5 × 2.8m
- **材质**：纯白色（0xf5f5f0，roughness 1.0）
- **行为**：`noCollision: true`（不阻挡寻路），需 **Shift + 拖拽**才能移动

### 2. 装饰画（Wall Art）

- **造型**：深棕画框 + 抽象四色金棕色块画布
- **尺寸**：画框 0.9 × 0.65 × 0.04m
- **材质**：画框深棕色（0x3d2b1f），画布四色（0xdaa520、0xcd853f、0xa0522d、0xf4a460）
- **行为**：`crossWall: true`（可跨墙拖拽，到角落自动切换墙面并旋转朝向）

---

## 五、灯具

定义于 `js/elements/lights.js`。

### 顶灯（Ceiling Light）

- **造型**：天花板安装盘 + 连接杆 + 锥形灯罩
- **灯光**：暖黄色 PointLight（0xffcc77），强度 2.0，距离 8，带阴影
- **行为**：`notMovable: true`（不可移动），点击切换开关

---

## 六、季节性户外物体

定义于 `js/elements/seasonalObjects.js`。

| 物体 | 造型 | 可见季节 |
|------|------|----------|
| 果子 | 红/橙色球体，放置在树冠上 | 秋季 |
| 蘑菇 | 棕色菌盖 + 红色斑点，草地上 | 秋季 |
| 雪人 | 三球体 + 黑色礼帽 + 红色围巾 | 冬季 |
| 树上雪团 | 匹配树冠形状的白色雪帽 | 冬季 |

---

## 七、分类体系（Category System）

定义于 `js/elements/categories.js`，采用**三层继承**的标签系统。

### 7.1 大类默认属性

```js
CATEGORY_DEFAULTS = {
    furniture:    { surface: 'floor' },
    light:        { notMovable: true, toggleType: 'light' },
    decoration:   {},
    'small-item': { movableType: 'small-item' },
}
```

### 7.2 装饰子类型覆盖

```js
DECORATION_OVERRIDES = {
    rug:     { surface: 'floor', noCollision: true },
    wallArt: { surface: 'wall-left', crossWall: true },
}
```

### 7.3 小物品子类型覆盖

```js
SMALL_ITEM_OVERRIDES = {
    plant:          { rotationConstraint: 'horizontal' },
    cushion:        { rotationConstraint: 'horizontal' },
    book:           { rotationConstraint: 'any' },
    bookshelfBooks: { rotationConstraint: 'any' },
}
```

### 7.4 合并规则

`applyDefaults(obj, category, subType)` 先取大类默认，再用子类型覆盖，最终写入 `obj.userData`。

例如盆栽最终拥有：`{ movableType: 'small-item', rotationConstraint: 'horizontal' }`

### 7.5 userData 标签一览

| 标签 | 类型 | 含义 |
|------|------|------|
| `surface` | `'floor' \| 'wall-left' \| 'wall-right' \| 'wall-back' \| 'wall-front'` | 物体所在表面 |
| `crossWall` | `boolean` | 可在墙面间切换 |
| `movableType` | `'small-item'` | 标记为小物品 |
| `noCollision` | `boolean` | 不参与寻路碰撞 |
| `notMovable` | `boolean` | 不可拖拽 |
| `toggleType` | `'light'` | 可点击切换 |
| `rotationConstraint` | `'any' \| 'horizontal'` | 旋转自由度 |
| `itemBottomOffset` | `number` | group 原点到包围盒底部的距离 |
| `parentGroup` | `THREE.Group` | 子物体指向父物体 |
| `children` | `THREE.Group[]` | 父物体的子物体列表 |
| `_surfaceY` | `number` | 缓存的表面 Y 坐标 |
| `_he` | `THREE.Vector3` | 缓存的半尺寸（碰撞用） |

---

## 八、父子携带关系（Parent-Child System）

定义于 `js/interaction/dragControls.js`。

### 8.1 建立关系

- 小物品被**放下时**，向下 raycast 找到下方的家具 → 建立 `parentGroup ↔ children` 双向引用
- 只有**非小物品的可移动家具**才能成为 parent（小物品不能叠在小物品上）
- 配置文件中的 `parent` + `relPos` 字段可在构建时预设关系

### 8.2 携带行为

| 操作 | 效果 |
|------|------|
| 拖拽父物体 | 所有 children 跟随移动（缓存相对偏移） |
| 拖拽子物体 | 从父物体上**分离**，清除 parentGroup 引用 |
| 旋转父物体 | 子物体偏移跟着旋转（`offset.applyAxisAngle`） |

### 8.3 吸附模式

放下小物品时有两种模式：

- **模式 A — 拖拽放下**：用 raycast 找 parent，不改变小物品的 XY 位置，只绑定关系
- **模式 B — R 键翻转**：向下 raycast 找表面，重新定位 Y 坐标到表面上

---

## 九、挪动规则（Movement Rules）

### 9.1 地面家具（surface: 'floor'）

- 沿 **y=0 平面**移动（只改 x, z）
- **碰撞分离**：拖拽时实时检测与其他地面家具的 AABB 重叠，用**最小平移向量**推开（最多迭代 8 次）
- 如果推到墙边被挡住，剩余推力**转嫁给对方家具**（连锁推动）
- Q/E 键水平旋转 45°，旋转后重新碰撞检测

### 9.2 墙面物体（surface: 'wall-*'）

- 沿**对应墙面**移动（改 y + 墙面水平方向）
- `crossWall: true` 的物体（如装饰画）拖到角落时**自动切换到相邻墙面**，并旋转朝向

### 9.3 小物品（movableType: 'small-item'）

- 拖拽时用**向下 raycast** 实时探测鼠标下方的表面高度
- 在当前高度水平移动，松开时**吸附到最近表面**
- 排除墙面和天花板作为吸附目标

### 9.4 地毯（noCollision: true）

- 需要**按住 Shift 才能抓取**，防止误触
- 不参与寻路碰撞（pathfinding 中被忽略）

---

## 十、旋转约束（Rotation Constraints）

| 约束 | Q/E 键 | R 键 | 适用物品 |
|------|--------|------|----------|
| `horizontal` | ✅ 水平旋转 45° | ❌ 无反应 | 盆栽、抱枕 |
| `any` | ✅ 水平旋转 45° | ✅ 垂直翻转 90° | 书本 |
| 无约束 | ✅ | ❌ | 家具、装饰 |

R 键翻转的特殊逻辑：以**底面为锚点**，旋转后重算包围盒，保持物体底部 Y 坐标不变（避免悬空或陷入）。

---

## 十一、边界限制（Boundary Clamping）

不同类型的物品有不同的边界约束：

| 类型 | X 限制 | Y 限制 | Z 限制 |
|------|--------|--------|--------|
| 地面家具 | 房间宽 ± 半尺寸 | 固定 0 | 房间深 ± 半尺寸 |
| 小物品 | 房间宽 ± 半尺寸 | `[底面偏移, 房间高 - 半高]` | 房间深 ± 半尺寸 |
| 左/右墙物体 | 固定在墙面上 | `[半高, 房间高 - 半高]` | 房间深 ± 半尺寸 |
| 前/后墙物体 | 房间宽 ± 半尺寸 | `[半高, 房间高 - 半高]` | 固定在墙面上 |

---

## 十二、配置层的继承（Config-Level Inheritance）

`buildRoom()` 构建小物品时的继承逻辑（`js/elements/index.js`）：

1. **位置继承**：`relPos` + `parent` → 通过父家具的 quaternion 旋转 + position 偏移计算世界坐标
2. **旋转继承**：抱枕的 `rotation.y` 自动继承父家具的 Y 轴旋转
3. **批量生成**：`bookshelfBooks` 自动在每层生成 3-5 本书，随机尺寸和颜色，自动绑定为书架的 children
4. **预计算**：构建完成后预计算 `itemBottomOffset`，避免第一次拖拽时的偏移跳变

---

## 十三、寻路与碰撞的分离

- **寻路系统**（A* 网格，80×70，0.1m 分辨率）只认 `noCollision !== true` 的地面家具为障碍物
- **拖拽碰撞**只在地面家具之间发生，小物品和装饰不参与
- 地毯虽在地面上，但 `noCollision: true` 所以不阻挡角色行走

---

## 十四、设计语言总结

- **风格**：斯堪的纳维亚 / 宜家风格，配色温暖
- **材质色板**：
  - 木材：桦木色（0xdeb887）
  - 金属：深灰（0x2a2a2a）
  - 沙发面料：青绿（0x0097a7）
  - 椅子面料：亮黄（0xffda00）
  - 抱枕：珊瑚红（0xf06060）
  - 书本：蓝 / 黄 / 红（IKEA 品牌色）
  - 墙面：冷白（0xf4f8fa）
  - 地板：浅灰木（0xd4c8b0）
- **几何**：全部由基础几何体拼装，无贴图、无外部 3D 模型
- **核心设计思路**：用 `userData` 标签驱动行为，而不是类型继承 — 所有物品都是 THREE.Group，区别只在于 userData 里写了什么

---

## 十五、房间配置

目前只有**客厅（Room F）** 摆放了完整的家具和小物品，其余房间（A-E, G, H）为空壳。

### 客厅布局（Room F，8 × 7m）

| 物品 | 位置 | 旋转 |
|------|------|------|
| 沙发 | (-1.5, 0.5) | 90° |
| 单人椅 | (1.8, 1.2) | -45° |
| 茶几 | (0.3, 1.5) | 0° |
| 边桌 | (-3.0, -1.8) | 0° |
| 书架 | (-3.625, 0) | 90° |
| 落地灯 | (2.5, -1.5) | 0° |
| 地毯 | (0, 0.5) | — |
| 装饰画 | (-3.97, 2.0, -1.0) | 90° |
| 盆栽 | (-2.9, 0, -3.1) | — |
| 抱枕 ×2 | 沙发上（relPos） | 继承沙发 |
| 边桌书本 | 边桌上（relPos） | 0.3 rad |
| 书架书本 | 书架上（自动生成） | 继承书架 |

---

## 十六、关键文件索引

| 文件 | 内容 |
|------|------|
| `js/elements/furniture.js` | 家具工厂（6 种） |
| `js/elements/smallItems.js` | 小物品工厂（3 种） |
| `js/elements/decoration.js` | 装饰工厂（2 种） |
| `js/elements/lights.js` | 灯具工厂 |
| `js/elements/categories.js` | 分类属性注册表 |
| `js/elements/index.js` | buildRoom() 组装器 |
| `js/elements/seasonalObjects.js` | 季节性户外物体 |
| `js/materials.js` | 所有材质定义 |
| `js/config.js` | 全局常量 |
| `js/interaction/dragControls.js` | 拖拽控制系统 |
| `js/rooms/living-room.js` | 客厅配置 |
