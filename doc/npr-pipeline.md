# 渲染风格：水墨管线（当前）/ 三渲二（旧）

> **2026-09 更新**：项目已从三渲二切换到国风水墨管线（对标《诗中世界2.blend》）。
> 下方"三渲二方案"保留作历史参考，对应代码 `js/systems/toon.js` 仍可用但未接入。

## 水墨管线（js/systems/inkwash.js）

灵感来源：《诗中世界2.blend》整个场景 **0 盏灯**，全部材质是
Emission（无光照）+ 垂直渐变 ColorRamp + 3D Noise 晕染 + AO 暖棕 + 菲涅尔雾片。
光影是"画"上去的，不是算出来的。

Three.js 侧复刻：

| 原作（Blender） | 本项目（Three.js） |
|---|---|
| Emission 无光照 | MeshBasicMaterial + onBeforeCompile 注入 |
| Noise → ColorRamp 晕染 | GLSL 3D value noise（世界坐标，uBlotch 强度） |
| AO 暖棕凹陷 | 低处水渍暗边（uLowY/uLowStain，近地面染晕） |
| LayerWeight 菲涅尔雾片 | createInkMist()：噪声透明度 + 四边渐隐的雾片组 |
| 宣纸纹理背景 | 纸感后处理 Pass（S 曲线 + 纸底提亮 + 纸纹颗粒 + 暗角）+ 暖雾融边 |
| 时段变化 | setInkTime()：不打光，只改全局乘色 uTimeTint / 纸色 / 雾色 |

接入点：
- `houseShell.js` / `main.js` 的 loadScene：`applyInkShading(root)` 替代 applyToonShading
- 材质保留 `name`/`color`/`map`：季节系统（set color）照常工作
- `MAT_window_view` / `MAT_window_glass` 例外保留 toon（timeOfDay 的 emissive 变色依赖它）
- `MAT_roof` 走专用变体（ROOF_GLSL）：无光照下瓦垄几何渲成平面，
  额外注入①法线 3 阶假光影（uRoofShade）②世界坐标瓦缝勾线（uRoofLine，
  顺坡垄线 + 横向等高垄线，噪声抖动仿手绘；不用 UV——屋顶 UV 是碎片化
  自动展开，不可用）。调参：`setInkRoof(shade, line)` 或 URL `?roofshade=&roofline=`
- `MAT_wall` 走专用变体（WALL_GLSL）：灰泥细颗粒 + 垂直刷痕（uWallGrain，
  世界坐标按墙面朝向投影 2D，不用 UV）。调参：`setInkWall(grain)` 或 URL `?wallgrain=`
- `MAT_leaves`（LEAF_GLSL）：树冠团块 3 阶假光影 + 底部压暗 + 叶簇碎点
  （uLeafShade/uLeafGrain）。季节系统克隆树叶材质走 cloneInkMaterial，变体随
  userData.inkVariant 保留，花色/秋色照常叠加
- `MAT_trunk`（TRUNK_GLSL）：纵向拉长 3D 噪声 = 环绕树干的竖向树皮纹（uBarkGrain）
- `MAT_rock`/`MAT_stone`（ROCK_GLSL）：硬切 3 阶块面（斧劈皴）+ 细颗粒
  （uRockShade/uRockGrain），作用于岛底岩层和石板路
- `MAT_floor_wood`（FLOOR_GLSL）：木地板拼缝勾线（顺 z 铺板、端缝逐排哈希错开）
  + 顺板向拉长的双层木纹 + 每板微色差（uWoodLine/uWoodGrain，只画朝上面）。
  调参：`setInkFloor(line, grain)` 或 URL `?floorline=&floorgrain=`
- 以上五项调参：`setInkFlora({leafShade, leafGrain, barkGrain, rockShade, rockGrain})`
  或 URL `?leafshade=&leafgrain=&barkgrain=&rockshade=&rockgrain=`
- `MAT_curtain`（CURTAIN_GLSL）：窗帘竖褶明暗 + 布纹
- `MAT_tread` / `MAT_railing` / `MAT_wood_*`（WOOD_GLSL）：木作 3 阶假光影
  + 细木纹（踏面顺长向、立柱竖向，按面朝向投影；uWoodShade/uWoodFine）——
  悬空踏步/细栏杆/家具木件无光照下不再糊成平涂纸片
- `MAT_fab_*`（FABRIC_GLSL）：布艺家具柔和 3 阶假光影 + 布纹颗粒
  （uFabShade/uFabGrain）——沙发/墩子的靠背、座面、侧面按法线朝向分面；
  以上两组调参 `setInkInterior({woodShade, woodFine, fabShade, fabGrain})`
- 抗锯齿：EffectComposer 离屏 RT 不吃 canvas 的 `antialias`——细窗棂/栏杆在相机
  微动时"闪"就是没 MSAA。composer 用 `samples: 4` 的 WebGLRenderTarget 构造
  （WebGL2 多样本）；`?msaa=0/2/4` 可调（默认 4，软渲染测试环境用 0 提速）
- 新增材质变体：在 VARIANTS 里登记材质名 + GLSL + cache key 即可
- 克隆材质必须用 `cloneInkMaterial()`（Material.clone 丢 onBeforeCompile）
- `main.js` 蒙版 `timeOfDay.update` → 每次时段变化后调 `setInkTime`
- 雾片只在室外场景显示（onActivated 里 `inkMist.visible`）
- 验收截图：`node tools/e2e/shot-roof.mjs`（屋顶开/关 + 多时段）、
  `node tools/e2e/shot-wall.mjs`（墙面开/关 + 室内外 + 傍晚）、
  `node tools/e2e/shot-flora.mjs`（树/石板路开/关 + 秋季 + 岛底岩层）

---

# 旧方案存档：三渲二（NPR）：Blender 还是 Three.js？

## 结论先行

**在 Three.js 做。** Blender 负责准备"适合三渲二的素材"，Three.js 负责渲染效果。

原因很简单：你有动态时间系统（清晨→中午→傍晚→夜晚），如果用 Blender 把光影烘焙到贴图上，太阳一移动画面就不对了。

---

## 为什么不在 Blender 做三渲二？

Blender 的三渲二依赖 **Shader to RGB** 节点 + **ColorRamp** 做色阶切分，这两个是 EEVEE/Cycles 的专属功能，**GLB 导出时会丢失**。

GLB 只支持 PBR 管线（BaseColor / Metallic / Roughness / Normal / Emissive / AO）。你在 Blender 里看起来再好的 cel shading，导出后就变回普通 PBR 了。

所以 Blender 的角色是"素材准备"，不是"效果制作"。

---

## Blender 侧要做什么

### 1. 模型简洁化

三渲二忌讳高面数和细节：
- 用低多边形风格，面数够表达形状就行
- 避免微小的倒角（bevel），要么不做，要么做大块的
- 树的叶子用块状 Plane 表达，不要用密集粒子

### 2. 贴图：用平涂色块，不要 PBR 写实

三渲二的贴图是"动漫风格"的，不是写实的：

| 贴图类型 | 写实风格 ❌ | 三渲二风格 ✅ |
|---------|-----------|-------------|
| Base Color | 照片级木纹 | 平涂的浅棕色，带简单笔触 |
| Normal Map | 高精度法线凹凸 | **不需要**，三渲二就是要平 |
| Roughness | 微妙的粗糙度变化 | **不需要**，直接 roughness=1 |
| AO Map | 写实环境光遮蔽 | 简化版：只在角落有明确暗部 |

**做法**：
- 在 Blender 的 Texture Paint 模式或外部绘图软件画贴图
- 颜色用大色块，暗部用稍深的大色块，不要渐变
- 线稿/边缘线可以画在贴图里（比如窗户框、门框的边缘）

### 3. 不要用 Principled BSDF

或更准确地说，把 Principled BSDF 的参数简化到极致：

```
Base Color  → 动漫平涂色
Roughness   → 1.0（完全粗糙，无高光）
Metallic    → 0.0（无金属感）
Specular    → 0.0
Emission    → 需要发光的才用（灯、窗户）
```

Blender 里这样设置后，导出 GLB 在 Three.js 里加载，然后用 MeshToonMaterial 替代 Standard Material（见下一节）。

### 4. 可选：顶点色替代贴图

如果你的模型不需要纹理细节（比如纯色墙壁、纯色地板），连贴图都不用画，直接给模型分配材质颜色就行。更极端的做法是用 **顶点色（Vertex Color）** 在 Blender 里直接画颜色在模型上——导出后可以用在 Three.js 的 cel shading 里。

### 5. 可选：边缘线模型（Inverted Hull）

这是做模型阶段就准备的方法——给每个需要边缘线的物体做一个"反向外壳"：

1. 选中 mesh → Shift+D 复制一份
2. 给复制体加 **Solidify Modifier**：
   - Thickness：0.02~0.05（看你模型大小）
   - Offset：-1（往内部膨胀）
   - **勾选 Flip Normals**
3. Material：纯黑色 Emission
4. 这个 mesh 渲染出来就是物体周围一圈黑线

导出时两个 mesh 一起导出。代码里让外壳一直用黑色 Emission 材质，不受光照影响。

**优点**：边缘线粗细不受摄像机距离影响
**缺点**：每个需要描边的物体都要做一份，模型面数翻倍

---

## Three.js 侧要做什么

### 核心方案：MeshToonMaterial + 后处理描边

Three.js 自带两个关键武器：

#### MeshToonMaterial

Three.js 内置的卡通材质，用法类似 MeshStandardMaterial 但渲染出来是色阶切分的：

```javascript
import * as THREE from 'three';

// 创建 toon 渐变贴图（3 阶 = 亮面 / 灰面 / 暗面）
const gradientMap = createToonGradient(3);

const material = new THREE.MeshToonMaterial({
  color: 0x8bbf6e,        // 草地颜色
  gradientMap: gradientMap, // 色阶贴图
  roughness: 1.0,         // 纯漫反射
});
```

**色阶贴图**就是一张 4×1 像素的图，定义亮到暗分几级：

```
3阶（经典三渲二）：  [亮] [中] [暗]
4阶：               [亮] [次亮] [次暗] [暗]
2阶（硬切）：        [亮] [暗]            ← 最动漫
```

这种贴图可以程序化生成，不需要图片文件。

#### 后处理描边（OutlinePass）

用 Three.js 的 EffectComposer + OutlinePass 做全屏描边：

```javascript
import { EffectComposer, RenderPass, OutlinePass } from 'three/addons';

const composer = new EffectComposer(renderer);
const outlinePass = new OutlinePass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  scene, camera
);
outlinePass.edgeStrength = 3.0;
outlinePass.edgeGlow = 0.0;
outlinePass.edgeThickness = 1.0;
outlinePass.pulsePeriod = 0;
outlinePass.visibleEdgeColor.set('#000000');
outlinePass.hiddenEdgeColor.set('#000000');

// 把需要描边的物体加到 selectedObjects
outlinePass.selectedObjects = [house, trees, furniture, ...];

composer.addPass(renderPass);
composer.addPass(outlinePass);
```

**问题**：距离远时线会变细，因为它在屏幕空间做边缘检测。

**对策**：远的物体线不明显其实还好，因为远的东西本来就不该有粗线。如果介意，可以结合 Inverted Hull 方法（见上节）用于近景物体。

#### 现在的项目已经有 Bloom（UnrealBloomPass），OutlinePass 可以和 Bloom 共存：

```
RenderPass → OutlinePass → UnrealBloomPass → OutputPass
```

---

## 完整三渲二管线总结

```
Blender 做的事：
  ├── 低面数模型
  ├── 平涂风格的 Base Color 贴图（或纯色/顶点色）
  ├── Roughness = 1, Metallic = 0（材质极简）
  ├── 可选：Inverted Hull 边缘线 mesh
  └── 导出 GLB

Three.js 做的事：
  ├── 加载 GLB → 遍历所有 mesh
  ├── 把 StandardMaterial 替换为 MeshToonMaterial
  ├── 设置 gradientMap（2~4 阶色阶）
  ├── 加载 OutlinePass 描边后处理
  ├── 可选：识别 Inverted Hull mesh → 设为黑色 Emission 材质
  └── 动态光照：太阳移动时，toon 材质自动响应（明暗面随之变化）
```

---

## 户外环境的特殊考虑

庭院/花园的植物在三渲二下有独特的要求：

- **草地**：MeshToonMaterial + gradientMap（2阶就够了），春绿秋黄冬白
- **树叶**：块状建模，不要细碎叶片；toon 材质 + 纯色，暗面比亮面深一阶
- **树干**：可以用 3 阶 toon（亮/中/暗），稍微有点立体感
- **花朵**：纯色 Emission（不受光照影响），保持鲜艳
- **雪**：纯白色，roughness=1，不需要 toon gradient——雪本身就是漫反射最强的东西

---

## 角色怎么办？

你的 `hazel-pink.vrm` 角色已经自带 **MToon 材质**（`@pixiv/three-vrm` 提供的），MToon 本身就是专门为三渲二设计的材质。所以角色不需要动——她已经是对的了。环境匹配她的风格就行。

---

## 总结对比

| | Blender 烘焙 | Three.js 实时 |
|------|-----------|-----------|
| 动态光照 | ❌ 光影固定 | ✅ 跟随太阳变化 |
| 效果精度 | ✅ 烘焙时怎么调都行 | ⚠️ 受限于实时 shader |
| 工作量 | 高（调好→烘焙→发现不好→重来） | 低（改 gradientMap 瞬间生效） |
| 文件体积 | 更大（烘焙贴图多） | 更小（贴图精简） |
| 与角色一致性 | ⚠️ 角色是实时 MToon，环境是烘焙，不统一 | ✅ 都是实时 toon |
| 性能 | 好（标准 PBR 管线） | 好（toon 比 PBR 还简单） |
