/**
 * 一天时间系统：6 时段平滑过渡（太阳位置/颜色、背景色、各灯强度）
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

/**
 * 创建时间系统
 * @param {THREE.Scene} scene
 * @param {ReturnType<import('./lighting.js').createLighting>} lighting
 * @returns {{ update: (value: number) => void }} value: 0~5 浮点时段
 */
export function createTimeOfDay(scene, lighting) {
    function update(value) {
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

        lighting.setLevels({
            sun:     lerp(a.sun,     b.sun,     t),
            ambient: lerp(a.ambient, b.ambient, t),
            fill:    lerp(a.fill,    b.fill,    t),
            spot:    lerp(a.spot,    b.spot,    t),
        });

        scene.background = new THREE.Color(a.bg).lerp(new THREE.Color(b.bg), t);
    }

    return { update };
}
