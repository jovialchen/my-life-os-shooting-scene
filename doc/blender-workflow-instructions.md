# Blender 建模操作指南

本文档是给人在 Blender 里实际操作时看的。每一步都有具体做法。

---

## 准备工作

1. 打开 Blender，新建或打开你的 `house.blend`（源文件自己保管，不要丢进 git）
2. 确认导出器：Blender 自带 glTF 2.0 导出（File → Export → glTF 2.0），不需要额外插件
3. **重要习惯**：导出前先 Ctrl+S 保存 .blend，再导出 GLB

---

## 一、标注表面属性（walkable / sittable / layable / placeable）

### 1.1 创建功能面

以"一楼地板"为例：

1. **Shift+A → Mesh → Plane**，命名 `WALK_floor_1f`
2. 在 Edit Mode 里调整顶点，让 Plane 精确覆盖你能走的范围（房间内部、走廊）
3. 如果房间不是矩形，用 **Knife 工具（K）** 切出形状，或者用多个 Plane 拼接
4. Plane 的 Y 坐标（Blender 里是 Z 轴朝上）放在地板表面高度，比如 Z=0.02（略高于视觉地板，避免 z-fighting）

### 1.2 添加 Custom Properties

1. 选中 `WALK_floor_1f`
2. 右侧面板 → **Object Properties**（橙色方块图标）→ 滚到最底部 → **Custom Properties**
3. 点击 **+ New**，类型选 **Boolean**
4. 属性名填 `surface_walkable`，勾选复选框 = True
5. 再点 **+ New**，加 `surface_placeable` = True（地板也可以放东西）

### 1.3 各类型对照表

| 物体 | 需要标的属性 |
|------|-------------|
| 一楼地板 | `surface_walkable` |
| 二楼地板 | `surface_walkable` |
| 庭院路面 | `surface_walkable` + `surface_placeable` |
| 楼梯踏步 | `surface_walkable` |
| 椅子座面 | `surface_sittable` + `surface_placeable` |
| 沙发座面 | `surface_sittable` + `surface_placeable` |
| 床面 | `surface_layable` + `surface_placeable` |
| 桌面 | `surface_placeable` |
| 柜子顶面 | `surface_placeable` |
| 书架隔板 | `surface_placeable` |

### 1.4 功能面的建模技巧

- **厚度**：Plane 不需要厚度，0.01m 的薄 Box 也行。代码只用它的上表面和顶点坐标。
- **不要和视觉 mesh 合并**：视觉地板是视觉地板，功能面是功能面，分开两个 mesh。
- **父级关系**：功能面可以挂在视觉 mesh 下面当子级（Ctrl+P），跟着一起移动。
- **导出可见性**：如果你不想渲染功能面，见下面 1.5。

### 1.5 功能面不参与渲染（两种方式）

**方式 A（推荐）——导出后代码过滤：**

什么都不做，导出 GLB 后让代码根据属性决定不渲染。功能面的 mesh 仍然在 GLB 里，但作为纯数据源使用。

**方式 B——Blender 里禁用渲染：**

在 Outliner 里点功能面旁边的 **相机图标**（Disable in Renders）→ 关掉。但需要测试你的 Blender 版本 glTF 导出器是否会跳过被禁用渲染的物体。（不同版本行为不一样，建议先用方式 A。）

---

## 二、门的制作

### 2.1 建模步骤

假设做一个朝右开的平开门：

1. **墙壁建模**：
   - 正常做墙，在门的位置留一个洞（宽度 = 门的实际宽度 + 一点缝隙，比如 0.9m 宽 × 2.1m 高）
   - 用 Boolean 切洞，或者直接建模时留空

2. **门板建模**：
   - **Shift+A → Mesh → Cube**，尺寸约 0.05 × 2.1 × 0.9（厚 × 高 × 宽）
   - 命名 `DOOR_entrance`

3. **关键一步——设 Origin 在铰链位置**：
   - 选中门板，按 **Tab** 进入 Edit Mode
   - 按 **A** 全选所有顶点
   - 按 **G** 移动顶点，让铰链侧的那条边对齐到门板的 **Object Origin**（橙色原点）

   举例：如果铰链在门板的左边（从外面看），就把所有顶点向右移，让铰链边正好在原点 X=0 处。这样旋转时门绕铰链转。

   - 或者用 **Cursor to Selected + Set Origin**：
     1. Edit Mode 里选中铰链侧的那条边
     2. **Shift+S → Cursor to Selected**
     3. Tab 退出 Edit Mode
     4. **Object → Set Origin → Origin to 3D Cursor**

4. **验证**：在 Object Mode 下按 **R** 旋转门板，看它是否绕铰链旋转。没问题的话 Ctrl+Z 撤销。

### 2.2 添加门的 Custom Properties

选中门板 mesh，在 Object Properties → Custom Properties 里添加：

| 属性 | 类型 | 值 | 说明 |
|------|------|-----|------|
| `interactable_type` | String | `door` | 必须是 "door" |
| `door_swing_angle` | Float | `90` | 开门最大角度（度） |
| `door_swing_dir` | String | `right` | "left" 或 "right"，从铰链侧看 |
| `door_slide` | Boolean | `False` | 平开门=False，推拉门=True |
| `door_locked` | Boolean | `False` | 是否锁住 |

**String 属性注意事项**：Blender 里添加 String 类型属性时，值不加引号，直接填 `door`。

### 2.3 推拉门的做法

1. 门板建模同上，但 origin 随便放（推拉门不旋转）
2. Custom Properties：`door_slide = True`，`door_swing_angle = 0.8`（表示滑动距离，单位米），`door_swing_dir` 不用管
3. 代码里会沿门板宽度方向平移而不是旋转

### 2.4 双开门

两个独立的门板 mesh，分别标：
- 左门板：`door_swing_dir = "left"`
- 右门板：`door_swing_dir = "right"`

---

## 三、四季叠加层的制作

### 3.1 通用原则

- 每个季节的叠加层是 **独立的 .blend 文件**（或独立 Collection），单独导出
- 叠加层 mesh 在 Blender 里 **和 house 模型用同一个坐标系**（原点对齐）
- 所以最好在同一个 .blend 里做，house 作为参考背景，导出时只选季节 mesh

### 3.2 春季：花朵

1. 在庭院地面位置散布小花。做法：
   - 建一朵小花（几个小 Plane 贴花瓣纹理，或者简单小球体）
   - 用 **Particle System**（Hair 模式）撒在 `WALK_courtyard` 面上
   - 或者手动 Alt+D（Linked Duplicate）复制几十份，随机旋转缩放
2. 选中所有花朵 mesh → 导出 `spring_flowers.glb`
3. 导出设置：勾选 **Selected Objects**，Format 选 **glTF Binary (.glb)**

### 3.3 秋季：地面落叶

1. 在树下和路面区域散布落叶。做法：
   - 建一片树叶（扁 Plane，橙色/红色材质）
   - 用 Particle System 撒布，或者手动散布在几个树下区域
   - 数量不用太多，50-100 片就够了
2. 导出为 `autumn_leaves.glb`

### 3.4 冬季：雪层

**雪层覆盖（snow_cover.glb）：**

1. 复制一份庭院地面 mesh（Shift+D）
2. 稍微上移 Z=0.02~0.05，避免 z-fighting
3. 白色材质，roughness=1
4. 只保留需要被雪覆盖的部分——比如树下、屋顶、不被遮挡的路面
5. 边缘不规则：用 Sculpt Mode 稍微推拉边缘，或者直接用 Knife 切出不规则形状
6. 导出为 `snow_cover.glb`

**雪人（snowman.glb）：**

1. 三个球体堆叠（Shift+A → Mesh → UV Sphere）：
   - 底球：radius=0.3，Z=0.3
   - 中球：radius=0.22，Z=0.7
   - 头球：radius=0.15，Z=1.05
2. 树枝手臂：两个细长 Cylinder，从中间球体两侧斜向上伸出
3. 石头眼睛/纽扣：几个小 Sphere，黑色材质，放在头和身体上
4. 鼻子：小 Cone，橙色，从脸部伸出
5. 可选帽子：一个 Cylinder + 一个扁 Cylinder（帽檐），黑色，放在头顶
6. 所有部件选中 → Ctrl+J 合并为一个 mesh
7. 命名 `SNOWMAN`，放在庭院你喜欢的固定位置
8. 导出为 `snowman.glb`

### 3.5 四季树叶的处理

如果你院子里的树在 house.glb 里，需要让树叶在冬天掉光：

- **树叶 mesh 必须独立**，和树干分开。
- 建议命名：`TREE_01_trunk`（树干）、`TREE_01_leaves`（树叶）
- 给树叶 mesh 加 Custom Property：`season_leaves = True`（代码会识别并控制它的显示/隐藏）
- 冬季时树叶 scale 到 0，其他季节正常显示

---

## 四、导出 GLB 设置

### 4.1 house.glb 导出

File → Export → glTF 2.0：

| 设置 | 值 |
|------|-----|
| Format | **glTF Binary (.glb)** |
| Include | 如果所有东西都在一个 Collection 里，选 **Visible Objects** 或 **Active Collection** |
| Transform | 保持默认 |
| Geometry → UVs | ✅ |
| Geometry → Normals | ✅ |
| Geometry → Tangents | ❌ |
| Geometry → Vertex Colors | ❌（除非你用顶点色做标记） |
| Geometry → Apply Modifiers | ✅ |
| Animation | ❌（house 不需要动画） |
| Compression | ❌ |

### 4.2 季节叠加层导出

同上，但注意：
- 只选该季节相关的 mesh
- 用 **Selected Objects** 模式
- 确保这些 mesh 的坐标和 house.glb 一致（在同一个场景里做的就行）

### 4.3 验证导出

导出后可以拖到在线 GLB 查看器里检查：
- https://gltf-viewer.donmccurdy.com/
- 检查 mesh 名字、层级结构是否完整
- Custom Properties 在线查看器不一定能显示，代码里用 `console.log(mesh.userData)` 确认

---

## 五、命名约定速查表

| 前缀 | 含义 | 例子 |
|------|------|------|
| `WALK_` | 可行走表面 | `WALK_floor_1f`, `WALK_stairs`, `WALK_courtyard` |
| `SIT_` | 可坐表面 | `SIT_chair_01`, `SIT_sofa` |
| `LAY_` | 可躺表面 | `LAY_bed_01` |
| `PLACE_` | 可放东西表面 | `PLACE_desk_01`, `PLACE_shelf_02` |
| `DOOR_` | 门板 | `DOOR_entrance`, `DOOR_bedroom` |
| `TREE_` | 树 | `TREE_01_trunk`, `TREE_01_leaves` |
| `SNOWMAN` | 雪人 | `SNOWMAN` |

命名不强制，属性才是代码读取的。但命名方便你在 Blender 的 Outliner 里快速找到东西。

---

## 六、常见问题

**Q: 楼梯怎么做 walkable？**

楼梯的每一步可以单独做一个 Plane，标 `surface_walkable`，放在对应的台阶高度。或者做一个整体的斜面 Plane，标 `surface_walkable`——代码会根据顶点 Y 坐标生成高度渐变的导航网格。

**Q: 二楼地板会覆盖一楼吗？**

不会。代码按高度排序处理——先处理一楼（低的），再处理二楼（高的）。二楼地板 mesh 只覆盖它自己那一片 XZ 范围，不覆盖的地方保留一楼数据。

**Q: 墙面要标属性吗？**

**不要**。不标任何 surface 属性的 mesh 自动视为障碍物。所以墙壁、柱子、树干什么都不要标。

**Q: 一个 mesh 既是 walkable 又是 placeable 怎么办？**

加两个 Custom Property 就行。比如庭院地面：`surface_walkable = True` + `surface_placeable = True`。

**Q: 功能面和视觉面重叠了，会闪烁吗？**

如果功能面 Z 比视觉面高 0.01~0.02，基本不会；而且如果代码选择不渲染功能面（方式 A），那根本不会闪烁。
