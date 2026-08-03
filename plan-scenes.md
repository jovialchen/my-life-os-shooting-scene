# 动森式多场景切换 实施计划（跨设备续做用）

> 本文档 = 完整计划 + 当前进度 + 续做指引。
> 在新设备上继续时，先读「当前进度」确认做到哪了，再从下一个待办阶段继续。

## 目标

把"单一场景、相机穿墙跟进室内"改为**动森式独立场景切换**：

- 13 个场景：室外岛屿(1) / 一楼(客厅、厨房+餐厅、客卫) / 二楼(卧室×3、卫生间×3、学习室) / 阁楼(游戏室×2)
- 每个房间：独立 glb、独立导航网格、独立固定机位
- 门 = 传送点：走近门 → 提示"按 E 进入"→ 按 E（或点击门）→ 淡出 → 切场景 → 淡入
- 室外看不到室内：房子外壳加**黑色内胆**（开门只见黑暗）+ **实色玻璃**（不透明）
- 室内反映室外光照：时间系统驱动每间房的"窗外光"+ 窗景片变色
- 楼梯动线：客厅 ↔ 学习室（二楼枢纽）↔ 阁楼游戏室A ↔ 游戏室B；同层房间门对门直连

## 已定设计决策（与用户确认过）

| 问题 | 决策 |
|---|---|
| 是否同一网页 | 是，同页切 3D 场景，不跳 URL |
| 二楼卫生间 | 独立房间建模（从卧室门传送进入） |
| 同层移动 | 门对门直连，无走廊场景 |
| 楼梯落点 | 客厅 ↔ 学习室 ↔ 阁楼游戏室A |
| 开门后看到什么 | 黑色内胆，一片黑 |
| 窗户 | 实色不透明玻璃（夜间暖黄发光作为可选加分项，阶段 6 做） |

## 总体架构

**单 THREE.Scene + 场景容器切换**（不为每个房间建独立 Scene）：

- renderer / composer / camera / controls / 角色 VRM / UI 全局唯一，不重建
- 室外 group 常驻（切走只 `visible=false`，切回秒切，季节/门状态不丢）
- 室内 group 按需加载、Map 缓存、同一时刻仅一个可见
- 导航网格（pathfinding 单例）、门列表（doors 单例）、机位表在切换时整体换绑

## 移动网络（双向传送点）

```
室外大门 ↔ 客厅
客厅 ↔ 厨房+餐厅      客厅 ↔ 客卫
客厅(楼梯) ↔ 学习室
学习室 ↔ 卧室1/2/3    卧室N ↔ 卫生间N
学习室(楼梯) ↔ 游戏室A ↔ 游戏室B
```

## 当前进度

### ✅ 阶段 1 已完成（场景管理骨架）

已提交的改动（未 git commit，工作区状态）：

- **新增 `js/systems/sceneManager.js`**：容器切换（visible 开关）、淡入淡出（300ms，`#fade-overlay`）、`switchTo(sceneId, spawnId)` / `registerSceneContainer` / `setInitialScene` / `getActiveScene` / `isTransitioning`；加载失败回滚；钩子 `loadScene` / `onDeactivate` / `onActivated`
- **`js/config.js`**：新增 `SCENES` 注册表（目前仅 `outdoor`，zones 复用现有 CAMERA_ZONES，spawn default `[-4,0,0]`）
- **`js/systems/cameraZones.js`**：新增 `setZones(zones, categories)` 换绑机位表（重建按钮、保留折叠状态、取消过渡、重置到首机位）；机位数据源从静态 import 改为可注入；`currentZone` 访问全部加了 `?.` 空值保护（修过一个 buildButtons 先于 goToZone 执行导致模块求值中断的 bug）
- **`js/systems/doors.js`**：新增 `clearDoors()`
- **`js/character/walker.js`**：新增 `teleport(x, y, z, rotY)`（清路径/状态/标记）
- **`js/systems/lighting.js`**：新增 `setWindowLightPose(position, target)`
- **`js/main.js`**：接入 sceneManager（`onActivated` 钩子：重建导航/机位/相机碰撞/描边 + teleport 落点）；`?scene=xxx` 调试参数；`__app.switchTo`；`loadScene` 目前是 stub（打 warn 返回 null，阶段 3 实现）
- **`index.html`**：`#fade-overlay` 遮罩（黑底，opacity 0.3s transition，`.on` 时 pointer-events: all 锁输入）
- **新增 `tools/e2e/smoke-app.mjs`**：无头浏览器冒烟测试（用 tools/e2e 里的 puppeteer+Chrome）

验证状态：`node tools/test-nav-real.mjs` 全绿；冒烟测试 SMOKE PASS（2 门、VRM、18 机位按钮、switchTo 拒绝未知场景、零报错）。

**注意：改动未 commit，换设备前记得先 `git add -A && git commit && git push`（或打 patch 带走）。**

### ✅ 阶段 2 已完成（室外外壳黑内胆 + 实色玻璃）

**注意实现方式偏离原计划**：当前设备（Windows）没有 Blender
（`tools/blender-5.1/` 是 Linux 便携版，未入库），改为**纯 Node 的 GLB
后处理脚本** `tools/add_shell_core.mjs`（几何只是盒体，无需 Blender）。
若以后在 Linux 设备重跑 Blender 管线重生了 house.glb，删掉
`models/house.nocore.glb` 备份后跑 `node tools/add_shell_core.mjs` 即可。

- **`tools/add_shell_core.mjs`（新增，管线第五步）**：读 `models/house.glb`
  （首次先备份为 `models/house.nocore.glb`，之后一律从备份出发，幂等），
  追加两个节点后重写 house.glb：
  - `GLASS_windows`（12 面，材质 `MAT_window_glass` 淡蓝灰 #9FB4BE）：
    从 WINDOW_01 格栅连通块自动聚类——先按薄轴质心检出 4 个外墙窗平面
    （北墙 z=-5.006、两翼前立面 z=3.969、中庭凹槽里墙 z=0.972、山墙
    z=4.956），面内 bbox 间隙 ≤0.35 连片。玻璃厚 0.07 嵌在格栅（0.11）
    深度内避免 z-fight，面内四周外扩 0.08 埋进墙/窗框。
    **坑1**：WINDOW_01 节点带 translation [0,5.8,0]，必须转世界坐标。
  - `CORE_black`（3 盒体，材质 `MAT_core_black` #050505 doubleSided）：
    两翼 x ±(3.75..9.30) z -4.72..3.68 + 中厅 x ±3.80 z -4.72..0.78，
    顶 y=6.02。**坑2**：房子平面不是矩形——两翼前凸（立面 z≈3.95）、
    中庭凹槽（里墙 z≈1.0，门廊 z 1..4 开敞）；单一通长盒体会穿出门廊
    立面。阁楼不放内胆：翼屋顶是前后坡+山墙的复杂组合，棱柱会穿出
    屋面（已踩坑），山墙尖窗全靠实色玻璃封死。
  - 两节点均 `nav_ignore: true`（不进导航、不封门洞）。
- **未删内饰**：旧室内导航/机位在阶段 3+ 退役前还要用，内饰被内胆挡住
  不可见即可，删了反而破坏 test-nav-real。
- **辅助脚本**：`tools/probe_glb_windows.mjs`（glb 节点/格栅连通块探查）、
  `tools/e2e/shot-shell.mjs`（5 机位目检截图：正面/开门/凹槽/北面/山墙）。
- `.gitignore` 加 `models/house.nocore.glb`。

验证状态：`node tools/test-nav-real.mjs` 全绿（障碍数不变）；
`check_island_glb.py` PASS；冒烟 SMOKE PASS；
`temp/shell_{front,door,recess,north,gable}.png` 目检：开门见纯黑、
窗玻璃实色淡蓝灰、屋顶/门廊无内胆凸出。

**本机测试环境差异（Windows）**：Git Bash 缺 coreutils（无 ls/grep/cat/
sleep），npm 要用 `node "C:/Program Files/nodejs/node_modules/npm/bin/
npm-cli.js"` 调用；python 用 `/c/ProgramData/miniconda3/python.exe`；
puppeteer+Chrome 已装在 `tools/e2e/`（node_modules 与 .cache 均已 gitignore）。

### ✅ 阶段 3 已完成（样板间——客厅全流程打通）

实现方式同阶段 2：无 Blender，房间 glb 用纯 Node 程序化生成。

- **`tools/make_room_living.mjs`（新增，房间模板）**：直写 `models/room_living.glb`
  （6×5×2.7m，16 节点 31KB）。确立房间规范：原点在门口地板中心；
  FLOOR_visible + WALK_floor 逻辑面（抬高 0.015，surface_walkable）；
  墙/天花板/家具平涂不标属性（自动障碍）；RUG/PLANT/LAMP/VIEW_window
  标 nav_ignore；北墙两窗洞带窗框十字棂 + 窗外 MAT_window_view 窗景片；
  DOOR_exit 独立 mesh、origin 在铰链，extras 含 door_target_scene=outdoor /
  door_target_spawn=houseWest。家具：沙发/茶几/电视柜+电视/书柜。
- **`tools/check_room_glb.py`**：节点 extras、WALK 面抬高、门 target extras、
  平涂材质、MAT_window_view 存在性。PASS。
- **`tools/test-nav-room.mjs`**：room glb 建网，spawn→四角寻路可达、
  地毯可走/沙发电视柜不可走。全绿。
- **`tools/add_shell_core.mjs`** 追加：DOOR_entrance（西大门）extras
  door_target_scene=f1_living / door_target_spawn=default（东门留给厨房）。
- **`js/config.js`**：SCENES 加 f1_living（glbs/2 机位+room 分组/spawn
  default=[0,0.02,0.9]）；outdoor 加 spawn houseWest=[-6.5,0,5.6]。
- **`js/main.js`**：loadScene 真加载器（GLTFLoader → applyToonShading →
  隐藏 WALK_ → 返回 group）；onActivated 统一 clearDoors + 遍历重注册门
  （状态经 userData._doorState 恢复）；挂 setOnDoorTrigger / initDoorPrompt。
- **`js/systems/doors.js`**：registerDoor 记录 targetScene/targetSpawn；
  新增 setOnDoorTrigger（开门瞬间触发，动画照播）；clearDoors 把开合状态
  暂存 obj.userData._doorState，重注册恢复（室外常驻门状态不丢）。
- **`js/systems/doorPrompt.js`（新增）**：距传送门 ≤1.2m 显示气泡
  （DOM 投影到门板上方，按 E 进入 xx / 回到室外，跟随 currentLang），
  keydown E 触发 switchTo。
- **`index.html`**：#door-prompt 气泡样式。
- **`js/systems/cameraZones.js`** 修 bug：refreshButtons 遍历旧 DOM 分组/
  按钮时新 categories/zones 里没有 → cat/zone undefined 崩溃（setZones
  里 goToZone 先于 buildButtons），两处加空值保护。
- **`tools/e2e/shot-room.mjs`（新增 E2E）**：气泡提示 → E 进客厅（落点/
  机位/门注册断言）→ E 回室外（houseWest 落点、18 机位恢复）→
  pickDoorAt + 真实点击西门切场景。ROOM E2E PASS。

验证：`test-nav-real` / `test-nav-room` / `check_island_glb` /
`check_room_glb` 全绿；smoke-app PASS；截图 `temp/room_living.png` /
`room_prompt.png` / `room_back_outdoor.png` 目检正常。

### ✅ 阶段 4 已完成（室内光照反映室外时间）

- **`js/config.js`**：TIME_PRESETS 每时段加 `view`（窗景变色：清晨橙
  →中午亮蓝→傍晚橙→夜晚深蓝）和 `lamp`（室内灯时段系数：白天 0、
  傍晚 1.0、夜晚 1.5）；SCENES 加 `lighting` 字段——f1_living：
  `sun:0`（室内无直射）、`ambient:0.75`、`spot:1.3`、
  `windowLight.position/target`（北窗外照向屋内）、
  `lamp{position,color,intensity,distance}`（吊灯下方）；
  outdoor：`spot:0`（旧内饰窗光已被黑内胆挡住，归零）。
- **`js/systems/lighting.js`**：新增常驻 `lamp` PointLight（初始强度 0）+
  `setLampPose(position,color,distance)`；setLevels 加 lamp 档；
  `setWindowLightPose`/`setLampPose` 位姿参数兼容数组 `[x,y,z]` 与
  `{x,y,z}`（**坑**：场景配置用数组，原实现只认对象 → Vector3.set 把
  x/y 赋成 undefined → NaN；z 因 three 的"undefined 保持原值"语义不
  变，bug 很隐蔽）。
- **`js/systems/timeOfDay.js`**：记录当前时段值；
  `setSceneProfile(def.lighting ?? null)`——换绑 sun/ambient/spot 倍率
  与窗光/顶灯位姿，lamp 强度 = 时段 lamp 系数 × 场景 lamp.intensity
  （无 lamp 配置 = 0），并立即按当前时段重算；窗光色温跟随太阳 HSL；
  `registerTintMaterials(root)` 按材质名收集 MAT_window_view /
  MAT_window_glass（自动去重，注册即上色），update 时 color+emissive
  联动变色（自发光强度：窗景片 0.55 透亮、玻璃 0.15 微反光）。
- **`js/main.js`**：onActivated 钩子调 `setSceneProfile`；loadScene 与
  室外 onModelsReady 各调 `registerTintMaterials`；启动时对初始场景
  套一次 profile。
- **`tools/e2e/shot-lighting.mjs`（新增 E2E）**：22 项断言——客厅
  sun 归零/窗光位姿/ambient 偏暗、三时段窗景片变色、傍晚顶灯渐开
  夜晚全开、切回室外光照还原；截图 temp/light_living_{noon,dusk,night}
  .png + light_outdoor_night.png 目检通过（白天亮蓝窗、傍晚橙窗、
  夜晚暖灯+深蓝窗、室外夜景玻璃深蓝）。

验证：test-nav-real / test-nav-room / check_room_glb / check_island_glb
全绿；smoke-app PASS；shot-room PASS（修复后复跑）；shot-lighting PASS。

### ✅ 阶段 5 已完成（批量建模剩余 11 间）

- **`tools/make_rooms.mjs`（新增，通用房间生成器）**：规格表驱动，一次产出
  11 间 glb（models/room_{kitchen,bath_f1,study,bed1-3,bath1-3,game_a,game_b}.glb）。
  规范与客厅一致，**所有门/窗只开在南/北墙**（门 rotY=0：南门 dir=left、
  北门 dir=right，都开向屋内）——东西墙实心，省去侧墙门旋转的复杂度。
  墙体按洞口表自动分段（带重叠检查）；窗框十字棂、窗台板、窗景片
  MAT_window_view、吊灯 LAMP（nav_ignore）每房标配；家具盒体不标属性
  （自动障碍）。卧室×3/卫生间×3 用同模板换配色。
- **客厅加门**：`make_room_living.mjs` 南墙加客卫门(x-1.8)/厨房门(x1.8)，
  北墙加楼梯门(x1.3)；北墙窗改为 [-1.9,-0.6]/[1.95,2.95]（楼梯门落点
  避开电视柜——**坑**：最初门放 x2.45，spawn 落在电视柜 bbox 里，
  test-nav-rooms 的 isWalkableWorld 抓出来了）。
- **室外东门接厨房**：`add_shell_core.mjs` 加 DOOR_entrance_east extras
  （→f1_kitchen/fromOutdoor）；config outdoor 加 spawn houseEast=[6.5,0,5.6]。
- **`js/config.js`**：`roomScene()` 模板（单主机位 45° 俯看 + 统一室内光照：
  sun 0 / ambient 0.75 / spot 1.3 / 窗光位姿按窗墙 / 顶灯居中）+ 11 场景
  注册；spawns 全连接表（fromXxx 命名，南门到达 rotY 0、北门 rotY π）；
  `__app.config.SCENES` 暴露给 E2E。
- **`tools/test-nav-rooms.mjs`（新增）**：遍历 SCENES 所有房间——每个
  spawn 落点 isWalkableWorld + default↔各 spawn 双向寻路（卧室 fromBath
  落点最初卡在床头板 0.18m 处被抓出，移到 z3.8）。
- **`tools/e2e/shot-all-rooms.mjs`（新增）**：全动线 25 次切换（室外→客厅
  →厨房→东门→客厅→客卫→学习室→卧室1-3+各自卫生间→阁楼A→B→原路退回
  室外），每站断言门图（door_target_scene/spawn 与 GRAPH 表一致）+ 落点
  与 config 一致；每房截图 temp/rooms_<scene>.png。
- **既有测试修正**：shot-room / shot-lighting 客厅门数 1→4。

验证：check_room_glb ×12 PASS；test-nav-real / test-nav-room /
test-nav-rooms 全绿；check_island_glb PASS；smoke-app / shot-room /
shot-lighting / shot-all-rooms 全 PASS；截图目检正常
（卧室机位构图偏角、床在画面外——留阶段 6 机位微调统一处理）。

### ⏭ 下一阶段：阶段 6（收尾）

## 分阶段实施

### 阶段 1：场景管理骨架 ✅ 已完成（见上）

### 阶段 2：室外房子外壳改造 ✅ 已完成（实现为 Node 后处理，见「当前进度」）

在现有 house 四步管线（split_house → fill_gaps → add_walkable → add_door）后加一步 `tools/add_shell_core.py`：

- 删内饰（若管线产物中有室内家具/楼梯等可视内饰）
- **黑色内胆**：比外壳内表面略小的深色盒体（normal 朝内或双面），保证从门窗洞口看进去是纯黑；标 `nav_ignore`
- **实色玻璃**：窗框洞口填不透明玻璃面片，Principled 平涂（rough=1/metal=0/spec=0，淡蓝灰）；材质名 `MAT_window_glass`，后续时间系统可按名联动变色
- 重新导出 `models/house.glb`，`python3 tools/check_island_glb.py` 回归 + 浏览器看开门/看窗效果
- house 管线命令格式：`tools/blender.sh -b models_src/house-split.blend --python tools/xxx.py`

### 阶段 3：样板间——客厅全流程打通 ✅ 已完成（实现为 Node 生成器，见「当前进度」）

**3.1 `tools/make_room_living.py`（房间模板脚本）**

仿 `tools/make_island.py` 程序化建模，建立全项目房间规范：
- 坐标系：房间独立坐标，**原点在门口地板中心**
- 地板：`WALK_floor` 逻辑面（抬高 0.01~0.02，`surface_walkable=True`）
- 墙/天花板/家具：平涂材质（rough=1/metal=0/spec=0），不标属性（自动障碍）；纯装饰标 `nav_ignore`
- 门：独立 mesh、origin 在铰链、door extras + **新增 `door_target_scene` / `door_target_spawn`**
- 窗户：开口 + 窗框；窗口外侧放**窗景片**（大面片，材质名 `MAT_window_view`，标 `nav_ignore`）
- 末尾 `save_as_mainfile(models_src/room_living.blend)` + 导出 `models/room_living.glb`（`export_extras=True, export_apply=True, export_animations=False`）
- 命令：`tools/blender.sh -b --python tools/make_room_living.py`

**3.2 校验**
- 仿 `check_island_glb.py` 写 `tools/check_room_glb.py`（节点 extras、WALK 面 bbox、门 extras 含 target_scene）
- 仿 `test-nav-real.mjs` 写 `tools/test-nav-room.mjs`：Node 加载 room_living.glb，断言 spawn→房内各点寻路可达

**3.3 JS 挂接**
- `config.js` 的 SCENES 加 `f1_living`（glbs: room_living.glb，1~2 个固定机位：斜 45° 俯看全屋，minDist/maxDist/maxPolar 锁小范围）
- 室外大门 extras 加 `door_target_scene='f1_living'`（改 house 管线 add_door.py 或新脚本）
- `main.js` 的 `loadScene` stub 换成真加载器（GLTFLoader 加载 glb → applyToonShading → 隐藏 WALK_ → registerDoor → 返回 group；参考 houseShell.js 的 house.glb 处理段）
- `doors.js`：门带 `door_target_scene` 时，开门动画照播 + 触发 `sceneManager.switchTo()`
- 客厅内放"出口门"（target=室外大门的 spawn）

**3.4 按 E 进入 + 提示 UI**
- 每帧检测角色与带 target 的门的距离，≤1.2m 显示提示气泡（DOM，"按 E 进入 xx"，跟随 `currentLang()`），keydown E 触发切换

**3.5 验证**
- 手动：室外 → 走近大门 → 提示 → E → 淡入客厅 → 客厅内走动 → 出口门 → 回室外原位
- `check_room_glb.py` + `test-nav-room.mjs` 绿；`?scene=f1_living&frames=600` 截图可用
- 冒烟：`PUPPETEER_CACHE_DIR=$PWD/tools/e2e/.cache node tools/e2e/smoke-app.mjs "http://127.0.0.1:PORT/index.html?frames=600"`（先起 `python3 -m http.server PORT`）

### 阶段 4：室内光照（反映室外时间）✅ 已完成（见「当前进度」）

- `timeOfDay.js`：保持全局 sun/ambient 驱动；室内场景激活时按场景配置覆盖 ambient 强度（室内偏暗）、禁用直射 sun 或仅留窗口光斑
- 每室内场景的 `windowLight` 位置/角度写进场景配置，切换时用 `lighting.setWindowLightPose` 重摆；强度/色温继续被 TIME_PRESETS 插值驱动
- **窗景片联动**：`MAT_window_view` 材质注册进 timeOfDay，时段变色（白天亮蓝/黄昏橙/夜晚深蓝）；`MAT_window_glass` 同理
- 夜晚室内灯：每房 1 盏 PointLight，夜间段自动开（场景配置 `lampLight`）

### 阶段 5：批量建模剩余 11 间 ✅ 已完成（实现为规格表驱动的 make_rooms.mjs，见「当前进度」）

| 场景 id | 房间 | 连接 |
|---|---|---|
| f1_kitchen | 厨房+餐厅 | ↔客厅 |
| f1_bath | 客卫 | ↔客厅 |
| f2_study | 学习室（二楼枢纽） | ↔客厅楼梯、↔卧室×3、↔阁楼楼梯 |
| f2_bed1/2/3 | 卧室×3 | ↔学习室、↔各自卫生间 |
| f2_bath1/2/3 | 卫生间×3 | ↔各自卧室 |
| attic_game_a | 游戏室A（阁楼枢纽） | ↔学习室楼梯、↔游戏室B |
| attic_game_b | 游戏室B | ↔游戏室A |

- 以 `make_room_living.py` 为模板；卧室模板复制 3 份改配色/布局，卫生间同
- 每间：建模 → 导出 → check_room_glb → test-nav 连通 → 接入 SCENES + 门 extras
- 每批 2~3 间后浏览器走一遍动线，不攒到最后

### 阶段 6：收尾

- 室外玻璃夜间暖黄发光（可选加分项）
- 室内机位微调；内存检查（反复切换 20 次）；旧室内机位（config.js 的 attic/f1/f2 共 13 个）确认新方案后删除
- 更新 `doc/blender-workflow-instructions.md`：房间建模规范（surface 约定、门 extras、窗景片约定）

## 关键风险与对策

- **事件监听器叠加**：doors/walker/cameraZones 都在 init 注册监听——init 全程只调一次，切换只走 clear/set 接口
- **门窗洞口穿帮**：黑色内胆必须比外壳所有开口都"靠内"，用 Blender 渲染预览（Cycles CPU 低采样）多视角确认无漏光
- **内存**：用"常驻+缓存"回避 dispose；如涨内存再加 LRU dispose

## 验收总标准

- 全动线可走通：室外→客厅→厨房/客卫→客厅→学习室→卧室→卫生间→学习室→阁楼A→B→原路退回室外
- 每间房：导航可达全地板、机位构图合理不穿墙、窗景/光照随 6 时段变化
- 室外：开门见黑、窗户实色看不进、既有功能（季节/时间/机位/门）零回归
- 测试：现有 test-nav-*.mjs 全绿 + 新增 check_room_glb / test-nav-room 全绿 + smoke-app.mjs PASS

## 常用命令速查

```bash
# 导航回归
node tools/test-nav-real.mjs
node tools/test-nav-room.mjs
node tools/test-nav-rooms.mjs        # 全房间 spawn 连通（阶段 5）
# 房间 glb 生成 / 校验
node tools/make_room_living.mjs      # 客厅（4 门）
node tools/make_rooms.mjs            # 其余 11 间（阶段 5）
python3 tools/check_room_glb.py [glb路径]   # 缺省 room_living，可逐房间传参
# 浏览器冒烟（无头，含截图 temp/smoke_outdoor.png）
python3 -m http.server 8130 --bind 127.0.0.1 &
PUPPETEER_CACHE_DIR=$PWD/tools/e2e/.cache node tools/e2e/smoke-app.mjs "http://127.0.0.1:8130/index.html?frames=600"
# 场景切换 E2E（按 E 进出客厅全链路）
PUPPETEER_CACHE_DIR=$PWD/tools/e2e/.cache node tools/e2e/shot-room.mjs "http://127.0.0.1:8130"
# 室内光照 E2E（三时段窗景变色/顶灯/光照换绑）
PUPPETEER_CACHE_DIR=$PWD/tools/e2e/.cache node tools/e2e/shot-lighting.mjs "http://127.0.0.1:8130"
# 全动线 E2E（13 场景 25 次切换，阶段 5 验收）
PUPPETEER_CACHE_DIR=$PWD/tools/e2e/.cache node tools/e2e/shot-all-rooms.mjs "http://127.0.0.1:8130"
# Blender 无头跑脚本
tools/blender.sh -b --python tools/make_room_living.py
tools/blender.sh -b models_src/house-split.blend --python tools/add_shell_core.py
# house 外壳第五步（黑内胆+实色玻璃，Node 后处理，无需 Blender）
node tools/add_shell_core.mjs
# 外壳目检截图（先起本地服务器，见冒烟命令）
PUPPETEER_CACHE_DIR=$PWD/tools/e2e/.cache node tools/e2e/shot-shell.mjs "http://127.0.0.1:8131"
# glb 校验
python3 tools/check_island_glb.py
# 人工看效果
python3 -m http.server 8000   # 开 http://localhost:8000
```
