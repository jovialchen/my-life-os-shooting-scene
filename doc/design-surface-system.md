# 表面属性系统 & Blender 建模方案

## 概述

所有 3D 建模在 Blender 中完成，表面属性（可行走、可坐、可躺、可放东西）通过 Blender Custom Properties 标注在 mesh 上，随 GLB 导出。Three.js 端读取 `userData` 自动生成导航网格、交互点和物品放置位。

---

## 1. Blender 侧：Custom Properties → GLB extras

### 工作流

```
Blender 选中 mesh → Object Properties → Custom Properties → 添加属性 → 导出 GLB → Three.js 读取 userData
```

### 属性定义

| 属性名 | 类型 | 值 | 含义 |
|--------|------|-----|------|
| `surface_walkable` | Boolean | `True` | 人可以在上面走 |
| `surface_sittable` | Boolean | `True` | 人可以坐在上面 |
| `surface_layable` | Boolean | `True` | 人可以躺在上面 |
| `surface_placeable` | Boolean | `True` | 可以在上面放小物品 |
| `interactable_type` | String | `"door"` | 交互物体类型（目前只有门） |

一个 mesh 可以有多个属性。例如：

- 床的顶面：`layable` + `placeable`
- 椅子的座面：`sittable` + `placeable`
- 桌子的顶面：`placeable`
- 楼梯踏步：`walkable`

### 建模规范

**1. 只保留有功能意义的 mesh（删除纯视觉的面）**

Blender 里建模时：
- 地板、路面、楼梯 → 独立的 Plane 或薄 Box，标 `walkable`
- 椅子座面 → 独立 Plane，标 `sittable` + `placeable`
- 床面 → 独立 Plane，标 `layable` + `placeable`
- 桌面、柜面 → 独立 Plane，标 `placeable`
- 墙壁、柱子 → 不标任何属性（自动视为障碍物）

**2. 命名建议**

属性已经提供了语义，命名可以不依赖编码。但为了方便在 Blender 里快速识别：

- `WALK_floor_1f` / `WALK_stairs` / `WALK_courtyard`
- `SIT_chair_01_seat` / `SIT_sofa_seat`
- `LAY_bed_01`
- `PLACE_table_01_top` / `PLACE_shelf_01`

**3. 关于不可见**

这些功能面在 Blender 渲染/预览时可以被父级 mesh 遮住，不影响 GLB 导出。如果你不想在最终画面里看到它们：
- 把它们移到独立 Collection → 导出时可以取消勾选（但需要确认 GLB 导出器会保留 extras）
- 或者在导出后，代码里根据属性决定是否渲染（比如只做 navmesh 数据源，不参与渲染）

推荐后者，用代码控制更灵活。

### 交互物体：门

门和表面不同——表面是静态的，门是**动态障碍物**。门关闭时堵住通道，打开后通路打开。所以门需要单独的属性系统和处理逻辑。

**建模规范：**

- **门框 / 带洞的墙**：正常建模，不需要标任何属性。墙上有洞的地方，walkable 面会自然透过去。
- **门板**：独立 mesh，标 `interactable_type = "door"`。门板的 **Object Origin 设在铰链位置**（即门绕 Y 轴旋转的轴心）。

**Blender 里门板的 extra 属性：**

| 属性 | 类型 | 值 | 含义 |
|------|------|-----|------|
| `interactable_type` | String | `"door"` | 这是一个门 |
| `door_swing_angle` | Float | `90` | 开门角度（度，默认 90） |
| `door_swing_dir` | String | `"left"` 或 `"right"` | 从铰链侧看，门往哪边开（默认 right） |
| `door_slide` | Boolean | `False` | True = 推拉门，False = 平开门（默认平开） |
| `door_locked` | Boolean | `False` | 是否锁定（锁定则不可交互） |

**运行时逻辑：**

```
1. surfaceParser 遇到 interactable_type = "door" → 创建 Door 对象
2. 门板 origin（铰链位置）→ 记录为旋转 pivot
3. 导航网格生成时：
   → 把门板 mesh 的包围盒作为"条件障碍"注册
   → 门关闭时：门板包围盒标为障碍
   → 门打开时：门板绕铰链旋转 door_swing_angle 度，包围盒移出通道，清除障碍
4. 玩家点击门 → 触发开门/关门动画 → 重建导航网格（局部更新）
```

**门和 walkable 面的关系：**

墙壁本身在导航网格里天然是障碍（没标 walkable 的 mesh 都是障碍）。门洞处如果墙没有建模（有个缺口），那么下方的 walkable 面会暴露出来，格子标记为可走——但门关闭时，门板 mesh 覆盖在上面，重新把那些格子标回障碍。

这比旧代码里手动算 `_markShellDoorWalls` / `_clearShellDoorway` 硬编码坐标干净得多——门的位置、大小、铰链在哪，全在模型里。

---

## 2. 模型组织

### 目录结构

```
models/
├── house.glb                    # 房子主体 + 家具（不动的东西）
├── seasons/
│   ├── spring_flowers.glb       # 春季：花朵
│   ├── autumn_leaves.glb        # 秋季：落叶覆盖
│   └── winter/
│       ├── snow_cover.glb       # 冬季：地面/屋顶雪层
│       └── snowman.glb          # 冬季：雪人
├── items/
│   ├── book_stack.glb           # 小物品
│   ├── teacup.glb
│   ├── vase_flowers.glb
│   ├── candle.glb
│   └── ...
└── items_catalog.json           # 物品目录
```

### 家具 vs 小物品

| | 家具（桌椅床柜沙发） | 小物品（书、杯、花、蜡烛） |
|---|---|---|
| **是否移动** | 不移动 | 可能移动/交换 |
| **建模位置** | 直接做在 house.glb 里 | 单独 GLB 文件 |
| **表面属性** | 在 Blender 里标好 | 不需要 |
| **加载方式** | 随房子一起加载 | 运行时按需加载 |
| **初始摆放** | 已在 Blender 里摆好 | 自动散布在 placeable 表面上 |

### 树的处理

树干 → 作为障碍物（不标任何表面属性，导航网格自动排除）。

树叶 → 独立 mesh（或独立文件），用于四季切换。

---

## 3. Three.js 侧：数据解析 & 系统

### 现有代码改动

#### 新增文件

```
js/systems/
├── surfaceParser.js          # 解析 GLB extras，提取表面数据
├── navmeshFromGLB.js         # 从表面数据生成带高度的导航网格
├── interactionMap.js         # 从表面数据生成交互点（坐/躺/放）
├── itemPlacement.js          # 小物品加载 & 自动摆放
└── seasons.js                # 增强：叠加层加载 + 材质颜色（修改现有文件）

js/elements/
└── houseShell.js             # 修改：加载后触发 surface 解析
```

#### 删除/替代逻辑

`pathfinding.js` 中以下硬编码逻辑将被 navmeshFromGLB 替代：
- `_markOutsideCircle` — 不再需要，navmesh 由模型驱动
- `_markRoomWalls` — 不再需要，没有 walkable 标记的 mesh 就是障碍
- `_markRoomBounds` — 同上
- `_markTreeTrunks` — 改为从 GLB 读取树干的包围盒

保留的核心逻辑：A* 寻路、路径平滑、视线检查。

### 表面解析器（surfaceParser.js）

```javascript
// 输入: GLTF.scene
// 输出:
{
  walkable: [
    { mesh, name, bbox: Box3, vertices: Vector3[], heightRange: { min, max } },
    ...
  ],
  sittable: [
    { mesh, name, centroid: Vector3, normal: Vector3, bbox: Box3, height: number },
    ...
  ],
  layable: [
    { mesh, name, centroid: Vector3, normal: Vector3, bbox: Box3, height: number },
    ...
  ],
  placeable: [
    { mesh, name, centroid: Vector3, normal: Vector3, bbox: Box3, height: number },
    ...
  ],
  obstacles: [
    { mesh, name, bbox: Box3 },  // 没有 surface 标记且不是门的 mesh 都是障碍
    ...
  ],
  doors: [
    { mesh, name, pivot: Vector3, swingAngle: number, swingDir: "left"|"right", isSliding: boolean, locked: boolean, bbox: Box3 },
    ...
  ]
}
```

解析规则：
- 遍历所有 mesh
- 读 `mesh.userData.surface_walkable` 等属性
- 有 `surface_*` 属性 → 归入对应 surface 类别
- 有 `interactable_type = "door"` → 归入 doors（门板 mesh 同时视为条件障碍）
- 没有任何标记的 mesh → 归入 obstacles

### 导航网格生成器（navmeshFromGLB.js）

**核心数据结构改变：**

```
现有：grid[gz * W + gx] = 0 或 1              （能不能走）
改为：grid[gz * W + gx] = height 或 -Infinity（能走且地面高度 / 障碍）
```

**生成逻辑：**

```
1. 确定网格范围
   → 遍历所有 walkable mesh + obstacles 的包围盒
   → 取 minX/maxX/minZ/maxZ，加一点 padding
   → 算 GRID_W, GRID_D, GRID_ORIGIN_X, GRID_ORIGIN_Z

2. 初始化全网格为 -Infinity（不可走）

3. 填充 walkable 区域
   → 按高度从低到高排序 walkable mesh
   → 对每个 walkable mesh：
       → 取所有顶点，投影到 XZ 网格
       → 对每个被覆盖的格子，写入顶点 Y 坐标（取被该 mesh 覆盖区域的最高值）
       → mesh 边缘格子用线性插值（用于楼梯渐变）
   → 后处理：同一个 XZ 格被多个 walkable mesh 覆盖时，保留最后写入的（高层覆盖低层）

4. 障碍物处理
   → 遍历所有 obstacle mesh
   → 将其 XZ 包围盒膨胀角色半径后，对应格子设为 -Infinity
   → 这一步会覆盖可能被误标为 walkable 的区域
```

**为什么"按高度排序"够用：**

二楼地板 mesh 只覆盖二楼房间面积那么大的 XZ 范围。范围之外，一楼的数据不会被覆盖。楼梯 mesh 的顶点天然形成从 0 到 3m 的斜坡，投影后形成高度渐变。

**楼梯导航：**

楼梯是斜面，顶点 Y 从低到高。投影到 XZ 网格后，相邻格子的 height 值自然渐变。角色沿路径移动时 Y 坐标跟着 height 走。

### 寻路改造

A* 寻路核心不变，但需要适配高度信息：

- 新增代价：两个相邻格子的 height 差 > 阈值 → 增加移动代价（爬楼梯比平地走慢）
- 路径点的 y 坐标从网格 height 值获取
- 全局寻路范围从 walkable mesh 的包围盒动态计算，不再硬编码

### 交互点生成（interactionMap.js）

针对 `sittable`、`layable`、`placeable` 表面，自动计算交互位置：

```
sittable 表面：
  → 取 mesh 包围盒的上表面中心
  → 交互点 = 中心 + 法线方向偏移 offset
  → 角色移动到附近 → 朝向表面法线 → 播放坐下动画

layable 表面（床等）：
  → 同上，但偏移量更大（躺下需要更多空间）
  → 交互点偏表面一侧（给枕头方向留空间）
  → 播放躺下动画

placeable 表面（桌面、柜面等）：
  → 在表面上生成均匀分布的点阵
  → 作为小物品的候选摆放位置
```

---

## 4. 小物品系统（itemPlacement.js）

### 物品目录（items_catalog.json）

```json
[
  {
    "id": "book_stack",
    "name": "书堆",
    "nameEn": "Book Stack",
    "model": "models/items/book_stack.glb",
    "radius": 0.15,
    "preferredSurfaces": ["desk", "shelf", "floor"],
    "count": 3,
    "height": 0.2
  },
  {
    "id": "teacup",
    "name": "茶杯",
    "nameEn": "Teacup",
    "model": "models/items/teacup.glb",
    "radius": 0.08,
    "preferredSurfaces": ["desk", "table"],
    "count": 2,
    "height": 0.1
  }
]
```

### 自动摆放逻辑

```
1. 加载 house.glb → 解析 surface → 得到所有 placeable 表面
2. 按 surface 类型分类（桌面优先、地面其次）
3. 对每个小物品：
   → 在合适的 placeable 表面上随机选点
   → 检查与已放置物品的间距（避免穿模）
   → 放置，物品 Y = 表面高度 + 物品高度偏移
4. 支持"重置"：清除所有小物品，重新随机摆放
```

---

## 5. 四季系统（seasons.js 增强）

### 策略：基础模型 + 叠加层

不建 4 套模型。基础模型（房子+家具+地面+树干）永远不变。

按季节加载/显示叠加层：

```
春季 (Spring, value 0):
  ├── 材质变化：草地 → 嫩绿，树叶 → 新绿
  └── 叠加层：spring_flowers.glb 显示

夏季 (Summer, value 1):
  ├── 材质变化：草地 → 深绿，树叶 → 浓绿
  └── 叠加层：无

秋季 (Autumn, value 2):
  ├── 材质变化：草地 → 枯黄，树叶 → 橙/红
  └── 叠加层：autumn_leaves.glb 显示（地面落叶）

冬季 (Winter, value 3):
  ├── 材质变化：草地 → 灰白
  ├── 叠加层：snow_cover.glb 显示（地面/屋顶雪层）
  ├── 叠加层：snowman.glb 显示（雪人，放在庭院）
  ├── 粒子系统：雪花飘落（纯代码生成，不需要模型）
  └── 树叶 mesh 隐藏（scale 到 0，模拟掉光）
```

### 冬季雪花粒子系统

用 Three.js 的 `Points` + `BufferGeometry` 实现，不需要额外模型文件。

```
参数设计：
  ├── 粒子数量：800-1200 片
  ├── 覆盖范围：以摄像机为中心，半径 20m，高度 8m 的圆柱体
  ├── 运动：匀速下落 + 水平飘动（sin 波）
  ├── 生命周期：落出底部后回到顶部重新开始
  ├── 速度：下落 0.3~1.0 m/s 随机，水平飘动幅度 0.2~0.8 m/s
  ├── 雪片大小：随机 0.03~0.08
  ├── 材质：白色圆点 texture（程序化生成，或用 PointsMaterial）
  └── 跟随摄像机：粒子生成区域始终以摄像机 XZ 为中心
```

性能考虑：
- 1200 个 Point 对 Three.js 没有压力
- GPU 粒子（ShaderMaterial）可以支持更多但没必要
- 雪只在冬季（value >= 2.75 左右）才开启，其他季节不创建/停止更新

### 雪人

在 Blender 里做一个简单的雪人模型，导出为 `snowman.glb`：
- 三个雪球堆叠（大小递减）
- 树枝手臂、石头按钮/眼睛、胡萝卜鼻子（可选）
- 顶上加个小帽子或水桶（可选）

加载逻辑：
- 和 snow_cover 一起在冬季加载
- 放在庭院某个固定位置（比如草地中央或房子门口）
- 其他季节隐藏

### 材质颜色控制

对带特定标记的 mesh 做颜色 lerp：

```javascript
// 搜索 mesh.userData.season_leaf_color 或命名约定
// 不在 Blender 加额外属性也行——遍历所有 mesh 的材质，
// 对名字带 "leaf" / "grass" / "bark" 的分别处理
```

### 季节叠加层的建模规范

- `spring_flowers.glb`：小花朵粒子的合集，散布在庭院和花坛位置
- `autumn_leaves.glb`：地面橙红色碎片，散布在树下和路面
- `snow_cover.glb`：白色覆盖层，略高于地面和屋顶，带不规则边缘
- `snowman.glb`：经典三球雪人，放在庭院指定位置

每个叠加层加载时默认 `visible = false`，按季节切换。

---

## 6. 完整数据流

```
┌─────────────────────────────────────────────────────────┐
│  Blender                                                │
│                                                         │
│  建模 → 标 Custom Properties → 导出 house.glb            │
│                                                         │
│  例: 一楼地板 mesh:                                     │
│      surface_walkable  = True                           │
│      surface_placeable = True                           │
│                                                         │
│  例: 椅子座面 mesh:                                     │
│      surface_sittable   = True                          │
│      surface_placeable  = True                          │
└──────────────────────┬──────────────────────────────────┘
                       │ house.glb
                       ▼
┌─────────────────────────────────────────────────────────┐
│  Three.js (houseShell.js)                               │
│                                                         │
│  GLTFLoader.load("house.glb")                           │
│      │                                                  │
│      ▼                                                  │
│  surfaceParser.parse(gltf.scene)                        │
│      │                                                  │
│      ├─→ walkable  →  navmeshFromGLB.generate()         │
│      │                   │                              │
│      │                   └─→  A* 寻路网格（带高度）       │
│      │                                                  │
│      ├─→ sittable  →  interactionMap.generateSitPoints()│
│      │                   │                              │
│      │                   └─→ 椅子交互点 → 角色靠近可坐下  │
│      │                                                  │
│      ├─→ layable   →  interactionMap.generateLayPoints()│
│      │                   │                              │
│      │                   └─→ 床交互点 → 角色靠近可躺下    │
│      │                                                  │
│      ├─→ placeable →  itemPlacement.suggestSpots()      │
│      │                   │                              │
│      │                   └─→ 物品自动摆放候选位           │
│      │                                                  │
│      ├─→ doors     →  注册条件障碍 + 交互对象             │
│      │                   │                              │
│      │                   ├─→ 门关闭：门板 bbox 标为障碍   │
│      │                   ├─→ 门打开：绕铰链旋转，清除障碍  │
│      │                   └─→ 玩家点击 → 开关门动画        │
│      │                                                  │
│      └─→ obstacles  →  navmeshFromGLB.markBlocked()     │
│                          │                              │
│                          └─→ 标记不可走格子              │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 7. 与你当前代码的兼容性

### 需要保留的

- **A* 寻路核心**（`pathfinding.js` 的 `findPath()`、`smoothPath()`、`MinHeap`）——只改网格数据来源
- **角色移动**（`walker.js`）——增加 Y 轴跟踪（路径点本身带 height）
- **时间系统**（`main.js` 里的 sun 更新）——不变
- **相机/控制器**——不变

### 需要移除的

- `pathfinding.js` 里的所有 `_mark*` 函数（约 300 行硬编码逻辑，全部被 GLB 元数据替代）
- `initApartmentGrid` — 不再需要手动传入 rooms/corridor/grass 参数

### 需要修改的

- `houseShell.js` — GLB 加载后触发 surface 解析
- `seasons.js` — 从只改草地颜色扩展到叠加层 + 树叶
- `config.js` — 增加季节叠加层路径等配置

---

## 8. 未决问题

以下问题留待后续确定：

1. **小物品交互深度**：纯静态自动摆放？还是支持玩家拖拽移动？后者需要射线检测 + UI
2. **楼梯动画**：斜面走路用普通动画就行，还是需要专门的爬楼动画？
3. **多层导航的极端情况**：如果庭院里有一棵大树，树冠上方没有 walkable 面，那树的投影在 XZ 网格上会是障碍物——这已经通过 obstacle 处理了。但如果未来有"树上平台"（树屋），就需要检查当前方案是否够用
4. **四季树叶**：树叶 mesh 是一个整体还是多片叶子？如果是整体，冬季只能整块隐藏；如果是多片，Geometry Nodes 可以动画化掉落过程（但这是后话）

---

## 9. 实施顺序建议

| 阶段 | 内容 | 依赖 |
|------|------|------|
| **Phase 1** | Blender 建模规范定稿 + 一个测试用 GLB（含 walkable 地面 + sittable 椅子 + 障碍墙壁） | 无 |
| **Phase 2** | `surfaceParser.js` + `navmeshFromGLB.js` → 角色能在模型驱动的导航网格上走路 | Phase 1 |
| **Phase 3** | `interactionMap.js` → 角色能检测到椅子并坐下 | Phase 2 |
| **Phase 4** | `itemPlacement.js` + `items_catalog.json` → 小物品自动摆放 | Phase 2 |
| **Phase 5** | `seasons.js` 增强 → 四季叠加层 | 无（独立） |

---

## 10. 实施现状（2026-07-28 更新）

Phase 1/2 已落地，与本文档有出入的实现细节：

- **`surfaceParser.js`**：按本文档实现（walkable / door / obstacle 三类）。
- **导航网格没有单独建 `navmeshFromGLB.js`**，而是重写了 `character/pathfinding.js`：
  格子存多个高度层（每格最多 4 层，0.4m 内合并），A* 状态 = (格子, 层)，
  相邻层高差 ≤ 0.35m 可通行；障碍物按净空规则（障碍点 y ∈ 层高+0.15 ~ +1.6）
  剔除高度层并膨胀一个角色半径。`userData.nav_no_inflate` 的障碍（楼梯踏步）
  不膨胀（陡坡会被自己的踏步封死）。
- **旧的 `_mark*` 硬编码已全部删除**，寻路范围由 walkable 面包围盒决定。
- **walker**：点击用射线打 walkable mesh（含隐藏 WALK_ 面），移动时 y 跟随
  `groundHeightAt`（楼梯平滑爬升）；门开合通过 `setOnDoorToggle` 触发
  `rebuildDynamicObstacles`（关门门板为动态障碍）。
- **房屋管线**（重新生成 `models/house.glb`，四步）：
  ```
  blender -b models_src/house.blend       --python tools/split_house.py
  blender -b models_src/house-split.blend --python tools/fill_gaps.py
  blender -b models_src/house-split.blend --python tools/add_walkable.py
  blender -b models_src/house-split.blend --python tools/add_door.py
  ```
  `add_walkable.py` 提取楼板/台面朝上面为 WALK_floors、加门口过渡面、
  并补全原模型北墙白色楼梯第一跑缺失的 5 级踏步（1F→2F，配斜坡
  WALK 面 + 东出 2F 楼板的过渡面）；第二跑（2F→阁楼）配
  `WALK_stairs_2f_attic` 斜坡面 + `WALK_stairs_atticout` 平台过渡面。
- **楼梯现状**：三层全部贯通（翼门→翼 1F→后厅→北墙白楼梯第一跑→2F
  →第二跑→阁楼楼板→阁楼内部）。阁楼近檐口净空 <1.6m 的区域按屋顶
  障碍自动剔除，角色只在屋脊下高净空区活动。
- **测试**：`node tools/test-nav.mjs`（合成场景单测）、
  `node tools/test-nav-real.mjs`（真实 GLB 全链路端到端）、
  `node tools/test-nav-attic.mjs`（2F→阁楼端到端）。
- Phase 3/4（坐躺交互、小物品摆放）未做。

### 岛屿花园 & 四季（2026-07-30 更新，Phase 5 的落地方式与 §5 不同）

四季没有走"叠加层 GLB"方案，而是**单一 island.glb + extras 驱动**
（`tools/make_island.py` 重新生成）：

- **地形**：岛面 48×10 同心环网格，低频正弦起伏（±0.3m，坡度 ≤13%），
  房子周边 2m 与岛缘自动压平；`WALK_island_top` 用同一高度场。
- **石板路**：绕屋圆角矩形环路 + 南向蜿蜒支路，石板高出地面 0.03m
  （< STEP_TOL，不挡导航）。
- **树 15 棵**：9 落叶树（主干 + 3~4 分枝，冬季枝干不"一根棍"）+
  6 松树（层叠锥冠，常青）。extras：`tree_type`、`leaf_spring`、
  `leaf_autumn`；每树叶球独立 mesh（JS 克隆材质单独着色）。
- **秋果**：`TREE_XX_fruits`（`season_fruits`），每树一种果色
  （深紫/红/橙，材质烘焙），秋季窗口绕树干锚点缩放显现。
- **雪**：`TREE_XX_snow`（`season_snow`）冬季显现；`SNOWMAN`
  （`season_snowman`，原点在底座直接整体缩放）。
- **应季花卉**：7 个 `FLOWERS_<种>` mesh，extras `flower_bloom_in/out`
  花期窗口（郁金香=春；绣球/薰衣草/向日葵=夏；波斯菊=夏秋；菊=秋；
  腊梅=冬），JS 按窗口透明度淡入淡出。
- **`nav_ignore`**：surfaceParser 新增第三类跳过规则（草丛/花/雪人，
  纯视觉不进导航）。
- **测试**：`node tools/test-seasons.mjs`（四季状态机冒烟）。
- 预览渲染：`tools/render_island_preview.py`、
  `tools/render_seasons_preview.py`（Blender 侧模拟四季状态出图）。
