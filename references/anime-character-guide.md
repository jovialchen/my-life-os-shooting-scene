# 动漫角色导入指南

将场景中的简单几何体人形替换为精美动漫角色模型的完整流程。

---

## 方案概览

| 方案 | 优点 | 缺点 | 适合场景 |
|------|------|------|----------|
| **VRM 模型**（推荐） | 一个文件含模型+贴图+骨骼，生态成熟 | 需要额外 three-vrm 插件 | 动漫 / VTuber 风格 |
| **GLB/GLTF 模型** | Three.js 原生支持，最通用 | 需要自己找贴图 | 通用 3D 模型 |

---

## 方案 A：VRM 模型（推荐）

### 什么是 VRM？

- 日本流行的 3D 虚拟人物标准格式，专为 VTuber / 虚拟场景设计
- 一个 `.vrm` 文件包含：模型网格 + 贴图 + 骨骼绑定
- 免费模型资源丰富，质量高

### 去哪找模型？

| 平台 | 链接 | 说明 |
|------|------|------|
| VRoid Hub | <https://hub.vroid.com/> | Pixiv 官方，海量免费动漫角色，可商用 |
| Booth.pm | <https://booth.pm/> | 搜 "VRM"，很多免费/付费精品 |
| VRoid Studio | <https://vroid.com/studio> | **自己捏人**，免费软件，导出 VRM |

### 用 VRoid Studio 自己捏角色

1. 下载安装 VRoid Studio（免费，Win / Mac）
2. 像游戏捏脸一样调整：脸型、眼睛、发型、服装、配饰
3. 导出为 `.vrm` 文件

### 代码集成

#### 1. 安装 three-vrm 插件

通过 CDN 在 `index.html` 的 importmap 中添加：

```html
<script type="importmap">
{
    "imports": {
        "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
        "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/",
        "@pixiv/three-vrm": "https://unpkg.com/@pixiv/three-vrm@3.0.0/lib/three-vrm.module.min.js"
    }
}
</script>
```

#### 2. 放置模型文件

```
my-life-os-shooting-scene/
├── models/
│   └── avatar.vrm          ← 把 VRM 文件放这里
├── js/
│   └── character/
│       └── humanoid.js      ← 替换为 VRM 加载逻辑
```

#### 3. 改写 `js/character/humanoid.js`

```js
/**
 * 角色：VRM 动漫角色加载器
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

export function createHumanoid() {
    const group = new THREE.Group();

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    loader.load('./models/avatar.vrm', (gltf) => {
        const vrm = gltf.userData.vrm;

        // 优化：移除不必要的顶点和骨骼
        VRMUtils.removeUnnecessaryVertices(gltf.scene);
        VRMUtils.removeUnnecessaryJoints(gltf.scene);

        // 开启阴影
        gltf.scene.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        // 调整位置和朝向
        vrm.scene.position.set(1.5, 0, 0.3);
        vrm.scene.rotation.y = -0.4;

        group.add(vrm.scene);
    });

    return group;
}
```

---

## 方案 B：GLB/GLTF 模型

### 去哪找模型？

| 平台 | 链接 | 说明 |
|------|------|------|
| Sketchfab | <https://sketchfab.com/> | 搜 "anime character"，筛选 "Downloadable" |
| ReadyPlayerMe | <https://readyplayer.me/> | 快速生成卡通风格 avatar，导出 GLB |
| Mixamo | <https://www.mixamo.com/> | Adobe 免费工具，预设角色带骨骼动画 |

### 代码集成

#### 1. 放置模型文件

```
my-life-os-shooting-scene/
├── models/
│   └── character.glb        ← 把 GLB 文件放这里
```

#### 2. 改写 `js/character/humanoid.js`

```js
/**
 * 角色：GLB 模型加载器
 */
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export function createHumanoid() {
    const group = new THREE.Group();

    const loader = new GLTFLoader();
    loader.load('./models/character.glb', (gltf) => {
        const model = gltf.scene;

        // 开启阴影
        model.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        // 调整位置
        model.position.set(1.5, 0, 0.3);
        model.rotation.y = -0.4;

        group.add(model);
    });

    return group;
}
```

---

## 本地预览注意事项

加载外部 `.vrm` / `.glb` 文件时，**双击 HTML 打开会触发浏览器 CORS 限制**，必须通过本地服务器访问：

```bash
# 方法 1：Python（最简单）
cd /root/projects/my-life-os-shooting-scene
python3 -m http.server 8080

# 方法 2：Node.js
npx serve .

# 方法 3：VS Code 插件
# 安装 "Live Server" 扩展，右键 index.html → Open with Live Server
```

然后访问 `http://localhost:8080`。

---

## 推荐的最快路径

1. 用 **VRoid Studio** 捏一个角色（约 30 分钟上手）
2. 导出 `.vrm` 文件放到 `models/` 目录
3. 替换 `js/character/humanoid.js` 中的加载逻辑（参考上方代码）
4. 起本地服务器预览效果
