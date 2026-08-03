/**
 * 一天时间系统：6 时段平滑过渡（太阳位置/颜色、背景色、各灯强度）
 *
 * 阶段 4 扩展：
 *   - setSceneProfile：场景切换时换绑光照配置（SCENES[*].lighting）——
 *     室内无直射阳光（sun×0）、环境光偏暗、窗光重摆位姿、夜间顶灯自动开
 *   - registerTintMaterials：按材质名收集窗景片/窗玻璃
 *     （MAT_window_view / MAT_window_glass），时段联动变色
 */
import * as THREE from 'three';
import { TIME_PRESETS, SUN_ORBIT_RADIUS } from '../config.js';

function smoothstep(t) { return t * t * (3 - 2 * t); }
function lerp(a, b, t) { return a + (b - a) * t; }
function lerpHSL(h1, s1, l1, h2, s2, l2, t) {
    let dh = h2 - h1;
    if (dh > 0.5) dh -= 1;
    if (dh < -0.5) dh += 1;
    return { h: (h1 + dh * t + 1) % 1, s: lerp(s1, s2, t), l: lerp(l1, l2, t) };
}

// 时段变色材质的自发光强度（窗景片要"透亮"，玻璃只要微反光）
const TINT_EMISSIVE = { MAT_window_view: 0.55, MAT_window_glass: 0.15 };

/**
 * 创建时间系统
 * @param {THREE.Scene} scene
 * @param {ReturnType<import('./lighting.js').createLighting>} lighting
 * @returns {{ update, setSceneProfile, registerTintMaterials }}
 */
export function createTimeOfDay(scene, lighting) {
    let currentValue = 2;               // 当前时段（切场景后重套用）
    let profile = { sun: 1, ambient: 1, spot: 1, lamp: 0 };   // 场景光照倍率
    const tintMats = [];                // { mat, emissiveBoost }
    const lastTint = new THREE.Color(TIME_PRESETS[2].view);

    function applyTint() {
        for (const { mat, emissiveBoost } of tintMats) {
            mat.color.copy(lastTint);
            if (mat.emissive) {
                mat.emissive.copy(lastTint);
                mat.emissiveIntensity = emissiveBoost;
            }
        }
    }

    function update(value) {
        currentValue = value;
        const idx = Math.min(Math.floor(value), TIME_PRESETS.length - 2);
        const t = smoothstep(value - idx);
        const a = TIME_PRESETS[idx];
        const b = TIME_PRESETS[idx + 1];

        const az = lerp(a.az, b.az, t) * Math.PI / 180;
        const el = lerp(a.el, b.el, t) * Math.PI / 180;
        lighting.sun.position.set(
            -SUN_ORBIT_RADIUS * Math.cos(el) * Math.sin(az),
            SUN_ORBIT_RADIUS * Math.sin(el),
            SUN_ORBIT_RADIUS * Math.cos(el) * Math.cos(az),
        );

        const hsl = lerpHSL(a.h, a.s, a.l, b.h, b.s, b.l, t);
        lighting.sun.color.setHSL(hsl.h, hsl.s, hsl.l);
        // 窗光色温跟太阳（提亮一点，保持"窗外光"感）
        lighting.windowLight.color.setHSL(hsl.h, hsl.s * 0.6, Math.min(hsl.l + 0.2, 0.95));

        lighting.setLevels({
            sun:     lerp(a.sun,     b.sun,     t) * profile.sun,
            ambient: lerp(a.ambient, b.ambient, t) * profile.ambient,
            fill:    lerp(a.fill,    b.fill,    t),
            spot:    lerp(a.spot,    b.spot,    t) * profile.spot,
            lamp:    lerp(a.lamp,    b.lamp,    t) * profile.lamp,
        });

        scene.background = new THREE.Color(a.bg).lerp(new THREE.Color(b.bg), t);

        // 窗景片/窗玻璃时段变色
        lastTint.set(a.view).lerp(new THREE.Color(b.view), t);
        applyTint();
    }

    /**
     * 换绑场景光照配置（场景切换时调用）
     * @param {object|null} def - SCENES[*].lighting；null = 默认（室外）
     *   { sun, ambient, spot 倍率, windowLight: {position,target}, lamp: {position,color,intensity,distance} }
     */
    function setSceneProfile(def) {
        profile = {
            sun: def?.sun ?? 1,
            ambient: def?.ambient ?? 1,
            spot: def?.spot ?? 1,
            lamp: def?.lamp ? (def.lamp.intensity ?? 1) : 0,
        };
        if (def?.windowLight) {
            lighting.setWindowLightPose(def.windowLight.position, def.windowLight.target);
        }
        if (def?.lamp) {
            lighting.setLampPose(def.lamp.position, def.lamp.color, def.lamp.distance);
        }
        update(currentValue);   // 立即按当前时段重套用
    }

    /**
     * 收集 root 下的时段变色材质（MAT_window_view / MAT_window_glass）
     * 场景模型加载/三渲二转换后调用；重复注册自动去重
     */
    function registerTintMaterials(root) {
        root.traverse((child) => {
            if (!child.isMesh || !child.material) return;
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            for (const mat of mats) {
                const boost = TINT_EMISSIVE[mat.name];
                if (boost === undefined) continue;
                if (tintMats.some((e) => e.mat === mat)) continue;
                tintMats.push({ mat, emissiveBoost: boost });
            }
        });
        applyTint();   // 新注册材质立即上当前时段的颜色
    }

    return { update, setSceneProfile, registerTintMaterials };
}
