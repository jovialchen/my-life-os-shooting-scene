/**
 * 灯光系统：环境光 + 太阳方向光 + 补光 + 窗光
 * 强度由时间系统通过 setLevels() 驱动
 */
import * as THREE from 'three';
import {
    AMBIENT_LIGHT_COLOR, AMBIENT_LIGHT_INTENSITY,
    SUN_COLOR, SUN_INTENSITY, SUN_POSITION,
    SUN_SHADOW_MAP_SIZE, SUN_SHADOW_LEFT, SUN_SHADOW_RIGHT, SUN_SHADOW_TOP, SUN_SHADOW_BOTTOM,
    SUN_SHADOW_NEAR, SUN_SHADOW_FAR, SUN_SHADOW_RADIUS, SUN_SHADOW_BIAS,
    FILL_LIGHT_COLOR, FILL_LIGHT_INTENSITY, FILL_LIGHT_POSITION,
    WINDOW_SPOT_COLOR, WINDOW_SPOT_INTENSITY, WINDOW_SPOT_DISTANCE, WINDOW_SPOT_ANGLE, WINDOW_SPOT_PENUMBRA,
    WINDOW_SPOT_POSITION,
} from '../config.js';

/**
 * 创建全部灯光并加入场景
 * @param {THREE.Scene} scene
 * @returns {{ sun, ambient, fill, windowLight, setLevels }}
 */
export function createLighting(scene) {
    const ambient = new THREE.AmbientLight(AMBIENT_LIGHT_COLOR, AMBIENT_LIGHT_INTENSITY);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(SUN_COLOR, SUN_INTENSITY);
    sun.position.set(SUN_POSITION.x, SUN_POSITION.y, SUN_POSITION.z);
    sun.castShadow = true;
    sun.shadow.mapSize.set(SUN_SHADOW_MAP_SIZE, SUN_SHADOW_MAP_SIZE);
    sun.shadow.camera.left   = SUN_SHADOW_LEFT;
    sun.shadow.camera.right  = SUN_SHADOW_RIGHT;
    sun.shadow.camera.top    = SUN_SHADOW_TOP;
    sun.shadow.camera.bottom = SUN_SHADOW_BOTTOM;
    sun.shadow.camera.near   = SUN_SHADOW_NEAR;
    sun.shadow.camera.far    = SUN_SHADOW_FAR;
    sun.shadow.radius = SUN_SHADOW_RADIUS;
    sun.shadow.bias = SUN_SHADOW_BIAS;
    scene.add(sun);

    const fill = new THREE.DirectionalLight(FILL_LIGHT_COLOR, FILL_LIGHT_INTENSITY);
    fill.position.set(FILL_LIGHT_POSITION.x, FILL_LIGHT_POSITION.y, FILL_LIGHT_POSITION.z);
    scene.add(fill);

    const windowLight = new THREE.SpotLight(
        WINDOW_SPOT_COLOR, WINDOW_SPOT_INTENSITY, WINDOW_SPOT_DISTANCE,
        WINDOW_SPOT_ANGLE, WINDOW_SPOT_PENUMBRA,
    );
    windowLight.position.set(-4 + WINDOW_SPOT_POSITION.x, WINDOW_SPOT_POSITION.y, -3.5 - 0.5);
    windowLight.target.position.set(-4, 0, 0);
    windowLight.castShadow = false;
    scene.add(windowLight);
    scene.add(windowLight.target);

    /** 应用一组强度（时间系统按时段计算后调用） */
    function setLevels({ sun: s, ambient: a, fill: f, spot: sp }) {
        sun.intensity = s;
        ambient.intensity = a;
        fill.intensity = f;
        windowLight.intensity = sp;
    }

    /** 重摆窗光位姿（场景切换时按场景配置调用） */
    function setWindowLightPose(position, target) {
        windowLight.position.set(position.x, position.y, position.z);
        windowLight.target.position.set(target.x, target.y, target.z);
    }

    return { sun, ambient, fill, windowLight, setLevels, setWindowLightPose };
}
