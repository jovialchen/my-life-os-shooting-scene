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
    uRoofShade: { value: 0.7 },                         // 屋顶瓦垄假光影强度（仅 MAT_roof）
    uRoofLine:  { value: 0.8 },                         // 屋顶瓦缝勾线强度（仅 MAT_roof）
    uWallGrain: { value: 0.45 },                        // 墙面灰泥纹理强度（仅 MAT_wall）
    uLeafShade: { value: 0.6 },                         // 树冠团块明暗强度（仅 MAT_leaves）
    uLeafGrain: { value: 0.4 },                         // 叶面碎点强度（仅 MAT_leaves）
    uBarkGrain: { value: 0.5 },                         // 树干竖纹强度（仅 MAT_trunk）
    uRockShade: { value: 0.6 },                         // 石头块面明暗强度（仅 MAT_rock/MAT_stone）
    uRockGrain: { value: 0.35 },                        // 石头颗粒强度（仅 MAT_rock/MAT_stone）
    uWoodLine:  { value: 0.55 },                        // 木地板拼缝勾线强度（仅 MAT_floor_wood）
    uWoodGrain: { value: 0.5 },                         // 木地板木纹强度（仅 MAT_floor_wood）
    uPaperStripe: { value: 0.3 },                       // 室内墙纸竖条纹强度（仅 MAT_wall_interior）
    uPaperGrain:  { value: 0.22 },                      // 室内墙纸细颗粒强度（仅 MAT_wall_interior）
    uCeilMottle:  { value: 0.14 },                      // 室内顶面大尺度斑驳强度（仅 MAT_ceiling_interior）
    uCurtainPleat: { value: 0.5 },                      // 窗帘竖褶明暗强度（仅 MAT_curtain）
    uCurtainGrain: { value: 0.25 },                     // 窗帘布纹颗粒强度（仅 MAT_curtain）
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

/** 屋顶材质：无光照下瓦垄全平，需要注入假光影 + 瓦缝勾线 */
const ROOF_MAT = 'MAT_roof';
/** 墙面材质：灰泥大平面，需要细颗粒 + 垂直刷痕的淡纹理 */
const WALL_MAT = 'MAT_wall';

/** 木地板材质：纯色大平面没看头，需要拼缝勾线 + 顺板木纹 */
const WOOD_FLOOR_MAT = 'MAT_floor_wood';

/** 室内墙材质：与外墙灰泥区分——墙纸竖条纹 + 更细的颗粒 */
const WALL_INTERIOR_MAT = 'MAT_wall_interior';
/** 室内天花板材质：平滑顶面，只留极淡斑驳 */
const CEILING_INTERIOR_MAT = 'MAT_ceiling_interior';
/** 窗帘布料：竖褶明暗 + 布纹 */
const CURTAIN_MAT = 'MAT_curtain';

const VARIANTS = {
    roof:  { mats: [ROOF_MAT],              compile: (s) => injectInk(s, ROOF_GLSL, ROOF_UNIFORMS),  key: 'inkwash_roof' },
    wall:  { mats: [WALL_MAT],              compile: (s) => injectInk(s, WALL_GLSL, WALL_UNIFORMS),  key: 'inkwash_wall' },
    wallInterior: { mats: [WALL_INTERIOR_MAT], compile: (s) => injectInk(s, WALL_INTERIOR_GLSL, WALL_INTERIOR_UNIFORMS), key: 'inkwash_wall_interior' },
    ceilingInterior: { mats: [CEILING_INTERIOR_MAT], compile: (s) => injectInk(s, CEILING_INTERIOR_GLSL, CEILING_INTERIOR_UNIFORMS), key: 'inkwash_ceiling_interior' },
    curtain: { mats: [CURTAIN_MAT],         compile: (s) => injectInk(s, CURTAIN_GLSL, CURTAIN_UNIFORMS), key: 'inkwash_curtain' },
    leaf:  { mats: ['MAT_leaves'],          compile: (s) => injectInk(s, LEAF_GLSL, LEAF_UNIFORMS),  key: 'inkwash_leaf' },
    trunk: { mats: ['MAT_trunk'],           compile: (s) => injectInk(s, TRUNK_GLSL, TRUNK_UNIFORMS), key: 'inkwash_trunk' },
    rock:  { mats: ['MAT_rock', 'MAT_stone'], compile: (s) => injectInk(s, ROCK_GLSL, ROCK_UNIFORMS), key: 'inkwash_rock' },
    floor: { mats: [WOOD_FLOOR_MAT],        compile: (s) => injectInk(s, FLOOR_GLSL, FLOOR_UNIFORMS), key: 'inkwash_floor' },
};
const variantOf = (name) => Object.keys(VARIANTS).find((k) => VARIANTS[k].mats.includes(name)) ?? '';

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
    const variant = variantOf(material.name);
    const v = VARIANTS[variant];
    ink.onBeforeCompile = v ? v.compile : inkCompile;
    ink.customProgramCacheKey = () => (v ? v.key : 'inkwash');
    ink.userData = { ...material.userData, inkwash: true, inkVariant: variant };
    return ink;
}

/**
 * 克隆水墨材质（Material.clone 不会带上 onBeforeCompile，需要重挂）
 * 季节树在 houseShell 里克隆树叶材质时用
 */
export function cloneInkMaterial(material) {
    const c = material.clone();
    if (material.userData?.inkwash) {
        const v = VARIANTS[material.userData.inkVariant];
        c.onBeforeCompile = v ? v.compile : inkCompile;
        c.customProgramCacheKey = () => (v ? v.key : 'inkwash');
    }
    return c;
}

/** onBeforeCompile 注入：世界坐标噪声晕染 + 暖赭偏移 + 低处水渍 + 时段调色 */
function inkCompile(shader) {
    injectInk(shader, '', '');
}

/** 屋顶变体 GLSL：在通用晕染之上叠加瓦垄假光影 + 世界坐标瓦缝勾线 */
const ROOF_GLSL = /* glsl */`
    // ── 瓦垄假光影：虚拟东南上方光源，3 阶色阶（皴擦感，让瓦垄起伏显形）──
    vec3 rn = normalize(vInkWorldNormal);
    float rnl = dot(rn, normalize(vec3(0.45, 0.75, 0.35))) * 0.5 + 0.5;
    float band = rnl < 0.42 ? 0.78 : (rnl < 0.72 ? 0.95 : 1.12);
    outgoingLight *= mix(1.0, band, uRoofShade);
    // ── 瓦缝勾线：世界坐标投影 + 噪声抖动（手绘勾勒，不依赖 UV）──
    float wob = (inkNoise(wp * 1.8) - 0.5) * 0.35;
    // 顺坡而下的垄线：坐标取坡面的水平切向
    vec3 tAcross = cross(rn, vec3(0.0, 1.0, 0.0));
    tAcross /= max(length(tAcross), 1e-3);
    float cRidge = dot(wp, tAcross) * 4.5 + wob;
    float fR = fract(cRidge);
    float ridgeLine = 1.0 - smoothstep(0.0, fwidth(cRidge) * 1.2 + 0.035, min(fR, 1.0 - fR));
    // 横向瓦垄（等高线，一垄一垄的叠瓦）
    float cRow = wp.y * 4.0 + wob * 1.4;
    float fW = fract(cRow);
    float rowLine = 1.0 - smoothstep(0.0, fwidth(cRow) * 1.2 + 0.05, min(fW, 1.0 - fW));
    float roofLine = max(ridgeLine, rowLine * 0.7);
    // 只在朝上/斜向上的坡面画线（屋檐底面、山墙立面不画）
    roofLine *= smoothstep(0.05, 0.35, rn.y);
    outgoingLight *= 1.0 - roofLine * uRoofLine * 0.5;
`;
const ROOF_UNIFORMS = 'uniform float uRoofShade;\nuniform float uRoofLine;';

/** 墙面变体 GLSL：灰泥细颗粒 + 垂直刷痕（淡，保持灰泥柔和，不勾硬线） */
const WALL_GLSL = /* glsl */`
    // ── 灰泥纹理：世界坐标按墙面朝向投影到 2D，避免依赖 UV ──
    vec3 wn = normalize(vInkWorldNormal);
    vec2 wuv = abs(wn.x) > 0.7 ? wp.zy : (abs(wn.z) > 0.7 ? wp.xy : wp.xz);
    // 垂直刷痕：横向快变、纵向慢变的条带噪声（抹子走竖纹）
    float streak = inkNoise(vec3(wuv.x * 7.0, wuv.y * 0.9, 3.7));
    // 细颗粒：两层高频噪声（灰泥的砂感）
    float g1 = inkNoise(vec3(wuv * 13.0, 7.3));
    float g2 = inkNoise(vec3(wuv * 31.0, 17.1));
    float wallGrain = (streak - 0.5) * 0.9 + (g1 - 0.5) * 0.6 + (g2 - 0.5) * 0.3;
    outgoingLight *= 1.0 + wallGrain * uWallGrain;
`;
const WALL_UNIFORMS = 'uniform float uWallGrain;';

/** 室内墙变体 GLSL：墙纸感——细竖条纹（0.07m 周期正弦，柔和不勾线）+ 更细更弱的颗粒。
 *  与外墙灰泥（粗抹痕+砂感）明确区分：条纹规则、颗粒细、振幅小 */
const WALL_INTERIOR_GLSL = /* glsl */`
    vec3 wn2 = normalize(vInkWorldNormal);
    vec2 wuv2 = abs(wn2.x) > 0.7 ? wp.zy : (abs(wn2.z) > 0.7 ? wp.xy : wp.xz);
    // 墙纸竖条：横向规则条纹 + 轻微噪声抖动（印刷墙纸，不是手工抹痕）
    float stripe = sin(wuv2.x * 6.28318 / 0.07
                       + (inkNoise(vec3(wuv2.y * 0.8, 2.2, 5.5)) - 0.5) * 0.8);
    // 细颗粒：两层高频噪声（纸面纤维，比外墙砂感细一档）
    float pg = inkNoise(vec3(wuv2 * 21.0, 9.1)) * 0.6
             + inkNoise(vec3(wuv2 * 47.0, 19.3)) * 0.4;
    outgoingLight *= 1.0 + stripe * 0.5 * uPaperStripe + (pg - 0.5) * uPaperGrain;
`;
const WALL_INTERIOR_UNIFORMS = 'uniform float uPaperStripe;\nuniform float uPaperGrain;';

/** 室内天花板变体 GLSL：平滑顶面，只留极淡的大尺度斑驳（安静，不抢墙面） */
const CEILING_INTERIOR_GLSL = /* glsl */`
    float cmottle = inkNoise(wp * 0.9) * 0.7 + inkNoise(wp * 2.3 + 4.0) * 0.3;
    outgoingLight *= 1.0 + (cmottle - 0.5) * uCeilMottle;
`;
const CEILING_INTERIOR_UNIFORMS = 'uniform float uCeilMottle;';

/** 窗帘变体 GLSL：竖褶明暗（对象本地 x 的余弦褶——scale.x 收拢时褶跟着压缩）
 *  + 布纹细颗粒。cos 是偶函数：左右两片（本地 x 一正一负）褶纹镜像对称 */
const CURTAIN_GLSL = /* glsl */`
    float cwob = (inkNoise(vInkLocalPos * 3.0) - 0.5) * 0.6;
    float pleat = cos(vInkLocalPos.x * 6.28318 / 0.16 + cwob) * 0.5 + 0.5;
    pleat *= pleat;   // 褶峰收窄、褶谷放宽
    outgoingLight *= mix(1.0, 0.72 + 0.5 * pleat, uCurtainPleat);
    float cloth = inkNoise(vec3(vInkLocalPos.xy * 40.0, 3.3)) * 0.5
                + inkNoise(vInkLocalPos * 90.0 + 7.0) * 0.5;
    outgoingLight *= 1.0 + (cloth - 0.5) * uCurtainGrain;
`;
const CURTAIN_UNIFORMS = 'uniform float uCurtainPleat;\nuniform float uCurtainGrain;';

/** 树冠变体 GLSL：团块假光影（动漫树丛的明暗面）+ 底部压暗 + 叶簇碎点 */
const LEAF_GLSL = /* glsl */`
    vec3 ln = normalize(vInkWorldNormal);
    // 团块明暗：虚拟东南上方光源，3 阶色阶
    float lnl = dot(ln, normalize(vec3(0.45, 0.75, 0.35))) * 0.5 + 0.5;
    float lband = lnl < 0.45 ? 0.80 : (lnl < 0.75 ? 1.0 : 1.12);
    outgoingLight *= mix(1.0, lband, uLeafShade);
    // 叶丛底部压暗（下方枝叶更密更暗）
    outgoingLight *= 1.0 - smoothstep(0.2, -0.6, ln.y) * uLeafShade * 0.3;
    // 叶簇碎点：两层细噪声模仿笔触
    float speck = inkNoise(wp * 9.0) * 0.6 + inkNoise(wp * 23.0 + 5.0) * 0.4;
    outgoingLight *= 1.0 + (speck - 0.5) * uLeafGrain;
`;
const LEAF_UNIFORMS = 'uniform float uLeafShade;\nuniform float uLeafGrain;';

/** 树干变体 GLSL：纵向拉长的 3D 噪声 = 环绕树干的竖向树皮纹 */
const TRUNK_GLSL = /* glsl */`
    float bark = inkNoise(vec3(wp.x * 13.0, wp.y * 1.6, wp.z * 13.0)) * 0.7
               + inkNoise(vec3(wp.x * 30.0, wp.y * 4.0, wp.z * 30.0) + 4.2) * 0.3;
    outgoingLight *= 1.0 + (bark - 0.5) * uBarkGrain;
`;
const TRUNK_UNIFORMS = 'uniform float uBarkGrain;';

/** 石头变体 GLSL：硬切 3 阶块面（斧劈皴）+ 细颗粒 */
const ROCK_GLSL = /* glsl */`
    vec3 kn = normalize(vInkWorldNormal);
    float knl = dot(kn, normalize(vec3(0.45, 0.75, 0.35))) * 0.5 + 0.5;
    float kband = knl < 0.45 ? 0.75 : (knl < 0.7 ? 0.95 : 1.15);
    outgoingLight *= mix(1.0, kband, uRockShade);
    float kgrain = inkNoise(wp * 11.0) * 0.6 + inkNoise(wp * 27.0 + 9.0) * 0.4;
    outgoingLight *= 1.0 + (kgrain - 0.5) * uRockGrain;
`;
const ROCK_UNIFORMS = 'uniform float uRockShade;\nuniform float uRockGrain;';

/** 木地板变体 GLSL：拼缝勾线（顺 z 铺板、端缝逐排错开）+ 顺板向拉长的木纹 + 每板微色差。
 *  只画在朝上的面（地板顶面），板侧/踢脚不画 */
const FLOOR_GLSL = /* glsl */`
    vec3 fn = normalize(vInkWorldNormal);
    float fUp = smoothstep(0.6, 0.9, fn.y);
    // ── 拼缝：板宽 0.14m（x 向）、板长 1.05m（z 向），端缝位置每排哈希错开 ──
    float wob = (inkNoise(wp * 1.6) - 0.5) * 0.05;               // 缝的手绘抖动
    float cX = wp.x / 0.14 + wob;
    float row = floor(cX);
    float fX = fract(cX);
    float seamX = 1.0 - smoothstep(0.0, fwidth(cX) * 1.5 + 0.025, min(fX, 1.0 - fX));
    float cZ = (wp.z + inkHash(vec3(row, 3.1, 7.7)) * 1.05) / 1.05;
    float seg = floor(cZ);
    float fZ = fract(cZ);
    float seamZ = 1.0 - smoothstep(0.0, fwidth(cZ) * 1.5 + 0.02, min(fZ, 1.0 - fZ));
    float seam = max(seamX, seamZ);
    // ── 木纹：沿板向（z）拉长的双层噪声，每排相位不同 ──
    float wg = inkNoise(vec3(wp.x * 34.0, wp.z * 2.4, row * 11.7)) * 0.65
             + inkNoise(vec3(wp.x * 68.0, wp.z * 5.5, row * 5.3 + 4.0)) * 0.35;
    // 每块板微色差（同一块板内一致）
    float tone = inkHash(vec3(row, seg, 1.3)) - 0.5;
    float woodMul = 1.0 + (wg - 0.5) * uWoodGrain + tone * 0.10;
    woodMul *= 1.0 - seam * uWoodLine * 0.5;
    outgoingLight *= mix(1.0, woodMul, fUp);
`;
const FLOOR_UNIFORMS = 'uniform float uWoodLine;\nuniform float uWoodGrain;';

function injectInk(shader, variantGLSL, variantUniforms) {
    const needNormal = variantGLSL.length > 0;
    Object.assign(shader.uniforms, U);
    shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
varying vec3 vInkWorldPos;
varying vec3 vInkLocalPos;${needNormal ? '\nvarying vec3 vInkWorldNormal;' : ''}`)
        .replace('#include <project_vertex>',
            `#include <project_vertex>
vInkWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
vInkLocalPos = transformed;${needNormal ? '\nvInkWorldNormal = normalize(mat3(modelMatrix) * normal);' : ''}`);
    shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
varying vec3 vInkWorldPos;
varying vec3 vInkLocalPos;${needNormal ? '\nvarying vec3 vInkWorldNormal;' : ''}
uniform vec3 uTimeTint;
uniform float uBlotch;
uniform float uNoiseScale;
uniform float uLowStain;
uniform float uLowY;
${variantUniforms}
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
${variantGLSL}
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

/**
 * 屋顶瓦片风格调参（仅 MAT_roof 生效）
 * @param {number|null} shade - 瓦垄假光影强度 0~1（null 不变）
 * @param {number|null} line  - 瓦缝勾线强度 0~1（null 不变）
 */
export function setInkRoof(shade = null, line = null) {
    if (shade !== null) U.uRoofShade.value = shade;
    if (line !== null) U.uRoofLine.value = line;
}

/**
 * 墙面灰泥纹理调参（仅 MAT_wall 生效）
 * @param {number|null} grain - 纹理强度 0~1（null 不变）
 */
export function setInkWall(grain = null) {
    if (grain !== null) U.uWallGrain.value = grain;
}

/**
 * 木地板调参（仅 MAT_floor_wood 生效）
 * @param {number|null} line  - 拼缝勾线强度 0~1（null 不变）
 * @param {number|null} grain - 木纹强度 0~1（null 不变）
 */
export function setInkFloor(line = null, grain = null) {
    if (line !== null) U.uWoodLine.value = line;
    if (grain !== null) U.uWoodGrain.value = grain;
}

/**
 * 植物/石头纹理调参（null 的项不变）
 * @param {{leafShade?:number, leafGrain?:number, barkGrain?:number, rockShade?:number, rockGrain?:number}} opts
 */
export function setInkFlora(opts = {}) {
    if (opts.leafShade != null) U.uLeafShade.value = opts.leafShade;
    if (opts.leafGrain != null) U.uLeafGrain.value = opts.leafGrain;
    if (opts.barkGrain != null) U.uBarkGrain.value = opts.barkGrain;
    if (opts.rockShade != null) U.uRockShade.value = opts.rockShade;
    if (opts.rockGrain != null) U.uRockGrain.value = opts.rockGrain;
}

/**
 * 室内质感调参（内墙墙纸/室内顶面/窗帘；null 的项不变）
 * @param {{paperStripe?:number, paperGrain?:number, ceilMottle?:number,
 *   curtainPleat?:number, curtainGrain?:number}} opts
 */
export function setInkInterior(opts = {}) {
    if (opts.paperStripe != null) U.uPaperStripe.value = opts.paperStripe;
    if (opts.paperGrain != null) U.uPaperGrain.value = opts.paperGrain;
    if (opts.ceilMottle != null) U.uCeilMottle.value = opts.ceilMottle;
    if (opts.curtainPleat != null) U.uCurtainPleat.value = opts.curtainPleat;
    if (opts.curtainGrain != null) U.uCurtainGrain.value = opts.curtainGrain;
}
