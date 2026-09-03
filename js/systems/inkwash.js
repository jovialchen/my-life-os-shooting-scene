/**
 * 国风水墨渲染系统（对标 诗中世界2.blend 的"无光照 Emission + 渐变晕染"管线）
 *
 * 与三渲二（toon.js）的区别：
 *   - 三渲二 = MeshToonMaterial 实时光照 + 硬色阶 + 描边 → 塑料感大色块
 *   - 水墨   = MeshBasicMaterial 完全无光照 + 世界坐标噪声晕染 + 低处水渍
 *              + 纸纹/暖调后处理 + 暖雾融边（Blend 原作就是这么做的：0 盏灯全 Emission）
 *
 * 组成：
 *   - applyInkShading(root)   材质转换：Standard/Toon → 水墨 Basic（保留 name/color/map，
 *                             季节系统 set color、窗玻璃 MAT_window_* 走 toon 保留 emissive）
 *   - createInkPaperPass()    纸感后处理：柔和 S 曲线 + 暖纸底 + 纸纹颗粒 + 暗角
 *   - createInkMist()         雾气片组：噪声透明度 + 边缘渐隐，随时间漂移
 *   - setInkTime(value, scene) 时段调色：不打光，只改全局色温/雾色/纸色（蒙版 timeOfDay.update）
 *   - updateInk(delta)        动画循环里推进雾的漂移
 */
import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { toToonMaterial } from './toon.js';

// ── 共享 uniforms（所有水墨材质引用同一组对象，改一处全局生效）──
const U = {
    uTimeTint:  { value: new THREE.Color(1, 1, 1) },   // 时段调色（乘算）
    uBlotch:    { value: 0.35 },                        // 颜料晕染强度
    uNoiseScale:{ value: 0.55 },                        // 晕染世界尺度
    uLowStain:  { value: 0.5 },                         // 低处水渍强度
    uLowY:      { value: 1.2 },                         // 水渍起始高度（世界 y）
    uMistTime:  { value: 0 },                           // 雾漂移时间
    uMistColor: { value: new THREE.Color(0xefe3c2) },   // 雾色（时段联动）
    uPaperColor:{ value: new THREE.Color(0xefe3c2) },   // 宣纸底色（时段联动，后处理用）
};

// ── 时段调色预设（对齐 config.TIME_PRESETS 六段，水墨不打光只调色）──
// tint = 全局乘色；paper = 宣纸底色（背景/雾/暗角都靠它）
const INK_TIME_PRESETS = [
    { tint: 0xc9a895, paper: 0xb7a699 },   // 清晨：灰粉微偏蓝
    { tint: 0xf2e2c2, paper: 0xcecdbc },   // 早上：暖亮带青
    { tint: 0xfff3da, paper: 0x8ec3ec },   // 中午：澄澈青蓝天空
    { tint: 0xf5dcb0, paper: 0xd0c5a7 },   // 下午：金黄微泛青
    { tint: 0xd99f78, paper: 0xb5957f },   // 傍晚：赭石微偏蓝
    { tint: 0x5d6a8f, paper: 0x2a3756 },   // 夜晚：靛蓝偏亮
];

// ── GLSL：3D value noise（颜料晕染用）──
const NOISE_GLSL = /* glsl */`
float inkHash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float inkNoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(mix(inkHash(i),                 inkHash(i + vec3(1,0,0)), f.x),
            mix(inkHash(i + vec3(0,1,0)),   inkHash(i + vec3(1,1,0)), f.x), f.y),
        mix(mix(inkHash(i + vec3(0,0,1)),   inkHash(i + vec3(1,0,1)), f.x),
            mix(inkHash(i + vec3(0,1,1)),   inkHash(i + vec3(1,1,1)), f.x), f.y),
        f.z);
}
`;

// ── 水墨材质转换 ─────────────────────────────────────────

/** 窗玻璃/窗景片保留 toon（timeOfDay 的 emissive 变色依赖它） */
const KEEP_TOON = new Set(['MAT_window_view', 'MAT_window_glass']);

/**
 * 单个材质 → 水墨材质（MeshBasicMaterial + onBeforeCompile 注入晕染/水渍/调色）
 * 已是 Basic/Shader(MToon)/toon 保留名的跳过或转 toon
 */
export function toInkMaterial(material) {
    if (!material) return material;
    if (material.isShaderMaterial || material.isMeshBasicMaterial) return material;
    if (KEEP_TOON.has(material.name)) return toToonMaterial(material);

    const ink = new THREE.MeshBasicMaterial({
        name: material.name,
        color: material.color?.clone() ?? new THREE.Color(0xffffff),
        map: material.map ?? null,
        side: material.side ?? THREE.FrontSide,
        transparent: material.transparent ?? false,
        opacity: material.opacity ?? 1,
        alphaTest: material.alphaTest ?? 0,
    });
    ink.onBeforeCompile = inkCompile;
    ink.customProgramCacheKey = () => 'inkwash';
    ink.userData = { ...material.userData, inkwash: true };
    return ink;
}

/**
 * 克隆水墨材质（Material.clone 不会带上 onBeforeCompile，需要重挂）
 * 季节树在 houseShell 里克隆树叶材质时用
 */
export function cloneInkMaterial(material) {
    const c = material.clone();
    if (material.userData?.inkwash) {
        c.onBeforeCompile = inkCompile;
        c.customProgramCacheKey = () => 'inkwash';
    }
    return c;
}

/** onBeforeCompile 注入：世界坐标噪声晕染 + 暖赭偏移 + 低处水渍 + 时段调色 */
function inkCompile(shader) {
    Object.assign(shader.uniforms, U);
    shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vInkWorldPos;')
        .replace('#include <project_vertex>',
            '#include <project_vertex>\nvInkWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
varying vec3 vInkWorldPos;
uniform vec3 uTimeTint;
uniform float uBlotch;
uniform float uNoiseScale;
uniform float uLowStain;
uniform float uLowY;
${NOISE_GLSL}`)
        .replace('#include <opaque_fragment>', /* glsl */`{
    vec3 wp = vInkWorldPos;
    float n1 = inkNoise(wp * uNoiseScale);               // 大块晕染
    float n2 = inkNoise(wp * uNoiseScale * 3.7 + 11.0);  // 颜料细节
    float blotch = n1 * 0.7 + n2 * 0.3;
    // 明度扰动（颜料厚薄不匀）
    outgoingLight *= 1.0 + (blotch - 0.5) * uBlotch;
    // 暖褐色调偏移（墨里带赭）
    outgoingLight = mix(outgoingLight, outgoingLight * vec3(1.06, 0.97, 0.86),
                        (n2 - 0.5) * uBlotch + 0.05);
    // 低处水渍暗边（贴近地面的染晕，仿 Blend 原作的 AO 暖棕）
    float low = smoothstep(uLowY, uLowY - 1.6, wp.y);
    outgoingLight = mix(outgoingLight, outgoingLight * vec3(0.80, 0.70, 0.58),
                        low * uLowStain * (0.4 + 0.6 * n1));
    // 时段全局调色
    outgoingLight *= uTimeTint;
}
#include <opaque_fragment>`);
}

/** 遍历 root 全部 mesh 转水墨材质（等价 toon.js 的 applyToonShading） */
export function applyInkShading(root) {
    let count = 0;
    root.traverse((child) => {
        if (!child.isMesh || !child.material) return;
        if (Array.isArray(child.material)) {
            child.material = child.material.map((m) => {
                const t = toInkMaterial(m);
                if (t !== m) count++;
                return t;
            });
        } else {
            const t = toInkMaterial(child.material);
            if (t !== child.material) {
                child.material = t;
                count++;
            }
        }
    });
    return count;
}

// ── 纸感后处理 Pass ──────────────────────────────────────

const InkPaperShader = {
    uniforms: {
        tDiffuse:    { value: null },
        uGrain:      { value: 0.10 },    // 纸纹颗粒强度
        uVignette:   { value: 0.25 },    // 暗角
        uPaperLift:  { value: 0.35 },    // 暗部纸底提亮上限（0~1 的混合比例上限）
        uPaperColor: { value: new THREE.Color(0xefe3c2) },  // 宣纸色（时段联动）
        uRes:        { value: new THREE.Vector2(1280, 720) },
    },
    vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
    fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse;
        uniform float uGrain;
        uniform float uVignette;
        uniform float uPaperLift;
        uniform vec3 uPaperColor;
        uniform vec2 uRes;
        varying vec2 vUv;

        float pHash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        float pNoise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(mix(pHash(i), pHash(i + vec2(1, 0)), f.x),
                       mix(pHash(i + vec2(0, 1)), pHash(i + vec2(1, 1)), f.x), f.y);
        }

        void main() {
            vec4 c = texture2D(tDiffuse, vUv);

            // 柔和 S 曲线（压低死黑死白，接近颜料阶调）
            c.rgb = mix(c.rgb, smoothstep(0.0, 1.0, c.rgb), 0.30);
            // 轻微提饱和（抵消 ACES + 纸底的洗色）
            float sat = dot(c.rgb, vec3(0.299, 0.587, 0.114));
            c.rgb = mix(vec3(sat), c.rgb, 1.15);

            // 暗部往宣纸色提（越黑提得越多，但有上限——黑内胆/深阴影不能变灰墙）
            float lum = dot(c.rgb, vec3(0.299, 0.587, 0.114));
            float lift = uPaperLift * (1.0 - smoothstep(0.02, 0.30, lum));
            c.rgb = mix(c.rgb, uPaperColor * 0.30, lift);

            // 纸纹颗粒：两层纤维噪声（横向拉丝 + 细颗粒）
            vec2 sp = vUv * uRes / 3.0;
            float fiber = pNoise(vec2(sp.x * 0.35, sp.y * 6.0)) * 0.5
                        + pNoise(vec2(sp.x * 6.0, sp.y * 0.35)) * 0.3
                        + pNoise(sp * 2.2) * 0.2;
            c.rgb *= 1.0 + (fiber - 0.5) * uGrain;

            // 暗角（四角微微泛黄变暗，像旧绢本）
            float d = distance(vUv, vec2(0.5));
            c.rgb *= 1.0 - smoothstep(0.42, 0.85, d) * uVignette;
            c.rgb = mix(c.rgb, uPaperColor * 0.8, smoothstep(0.55, 0.95, d) * uVignette * 0.5);

            gl_FragColor = c;
        }`,
};

export function createInkPaperPass() {
    const pass = new ShaderPass(InkPaperShader);
    pass.uniforms.uPaperColor = U.uPaperColor;   // 共享宣纸色，时段联动
    return pass;
}

// ── 雾气片 ───────────────────────────────────────────────

const mistMat = () => new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
        uMistColor: U.uMistColor,
        uMistTime: U.uMistTime,
        uOpacity: { value: 0.32 },
    },
    vertexShader: /* glsl */`
        varying vec2 vUv;
        varying float vSeed;
        attribute float seed;
        void main() {
            vUv = uv;
            vSeed = seed;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
    fragmentShader: /* glsl */`
        uniform vec3 uMistColor;
        uniform float uMistTime;
        uniform float uOpacity;
        varying vec2 vUv;
        varying float vSeed;
        ${NOISE_GLSL}
        void main() {
            // 漂移的 3D 噪声当雾的浓淡
            vec3 p = vec3(vUv * 3.0 + vSeed * 7.0, vSeed * 3.0 + uMistTime * 0.05);
            float n = inkNoise(p) * 0.65 + inkNoise(p * 2.7) * 0.35;
            float a = smoothstep(0.45, 0.85, n);
            // 四边渐隐（片状雾的边界不能硬）
            float edge = smoothstep(0.0, 0.30, vUv.x) * smoothstep(1.0, 0.70, vUv.x)
                       * smoothstep(0.0, 0.30, vUv.y) * smoothstep(1.0, 0.55, vUv.y);
            gl_FragColor = vec4(uMistColor, a * edge * uOpacity);
        }`,
});

/**
 * 岛屿边缘一圈竖直雾片 + 两片低空雾毯
 * @returns {THREE.Group}
 */
export function createInkMist() {
    const group = new THREE.Group();
    group.name = 'inkMist';
    const rng = (s) => { let x = Math.sin(s * 127.1) * 43758.5453; return x - Math.floor(x); };

    // 环岛竖直雾片（半透水墨远山感）
    for (let i = 0; i < 10; i++) {
        const w = 18 + rng(i) * 14;
        const h = 6 + rng(i + 40) * 5;
        const geo = new THREE.PlaneGeometry(w, h);
        const seeds = new Float32Array(geo.attributes.position.count).fill(rng(i + 80));
        geo.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));
        const m = new THREE.Mesh(geo, mistMat());
        const ang = (i / 10) * Math.PI * 2 + rng(i + 20) * 0.5;
        const r = 26 + rng(i + 60) * 10;
        m.position.set(Math.cos(ang) * r, 1.5 + rng(i + 90) * 2.5, 5 + Math.sin(ang) * r);
        m.rotation.y = -ang + Math.PI / 2 + (rng(i + 30) - 0.5) * 0.8;
        m.renderOrder = 90;
        group.add(m);
    }
    // 低空雾毯（水平，漂在草地外围——别盖住房子/庭院）
    for (let i = 0; i < 3; i++) {
        const geo = new THREE.PlaneGeometry(20 + i * 6, 20 + i * 6);
        const seeds = new Float32Array(geo.attributes.position.count).fill(rng(i + 120));
        geo.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));
        const m = new THREE.Mesh(geo, mistMat());
        m.rotation.x = -Math.PI / 2;
        const ang = rng(i + 130) * Math.PI * 2;
        m.position.set(Math.cos(ang) * 17, 0.5 + i * 0.6, 5 + Math.sin(ang) * 17);
        m.renderOrder = 89;
        group.add(m);
    }
    return group;
}

// ── 时段调色（水墨不打光：只改 tint / 纸色 / 雾）─────────

/**
 * @param {number} value - 0~5（对齐 TIME_PRESETS 索引，支持小数过渡）
 * @param {THREE.Scene} scene - 改背景色与雾色
 */
export function setInkTime(value, scene) {
    const v = THREE.MathUtils.clamp(value, 0, 5);
    const idx = Math.min(Math.floor(v), INK_TIME_PRESETS.length - 2);
    const t = v - idx;
    const s = t * t * (3 - 2 * t);
    const a = INK_TIME_PRESETS[idx];
    const b = INK_TIME_PRESETS[idx + 1];

    const tint = new THREE.Color(a.tint).lerp(new THREE.Color(b.tint), s);
    // tint 直接带亮度（水墨无光照，昼夜的明暗全靠它），不做归一化
    U.uTimeTint.value.copy(tint);

    const paper = new THREE.Color(a.paper).lerp(new THREE.Color(b.paper), s);
    scene.background = paper;
    U.uPaperColor.value.copy(paper);
    if (!scene.fog) scene.fog = new THREE.Fog(paper.getHex(), 30, 80);
    scene.fog.color.copy(paper);
    U.uMistColor.value.copy(paper).lerp(new THREE.Color(0xffffff), 0.25);
}

/** 动画循环里调用：雾漂移 */
export function updateInk(delta) {
    U.uMistTime.value += delta;
}
