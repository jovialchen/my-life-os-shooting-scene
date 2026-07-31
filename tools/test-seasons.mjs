/**
 * seasons.js 的 Node 冒烟测试（'three' 经 test-nav-loader.mjs 重定向到 three-stub.mjs）
 * 验证四季状态机：落叶树变色/落叶、松树常青、秋果/雪盖/雪人窗口、花卉花期。
 *
 * 运行：node tools/test-seasons.mjs
 */
import { register } from 'node:module';
register('./test-nav-loader.mjs', import.meta.url);

const THREE = await import('three');
const { initSeasons, updateSeason } = await import('../js/systems/seasons.js');

let failures = 0;
function check(name, cond, extra = '') {
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + extra + ')' : ''}`);
    if (!cond) failures++;
}

// ── 假 mesh/材质 ──
function fakeMat() {
    return { transparent: false, opacity: 1, color: { value: null, set(v) { this.value = v; } } };
}
function fakeMesh(mat) {
    return {
        isMesh: true,
        material: mat, visible: true,
        scale: { s: 1, setScalar(s) { this.s = s; } },
        position: { set(x, y, z) { this.x = x; this.y = y; this.z = z; } },
    };
}
// 多材质 mesh 在 GLTFLoader 里是 Group：extras 在 Group 上，材质在子 mesh 上
function fakeGroup(children) {
    return {
        isMesh: false,
        children, visible: true,
        scale: { s: 1, setScalar(s) { this.s = s; } },
        position: { set(x, y, z) { this.x = x; this.y = y; this.z = z; } },
        traverse(cb) { cb(this); for (const c of children) cb(c); },
    };
}

const SUMMER_LEAF = 0x3e7c33;
const SPRING = 0xf2a7c3, AUTUMN = 0xc9562e;

const grassMat = fakeMat();
const decLeaves = fakeMesh(fakeMat());
const decFruits = fakeMesh(fakeMat());
const decSnow = fakeMesh(fakeMat());
const pineLeaves = fakeMesh(fakeMat());
const pineSnow = fakeMesh(fakeMat());
const tulip = fakeGroup([fakeMesh(fakeMat()), fakeMesh(fakeMat())]);  // 多色花=Group
const sunflower = fakeMesh(fakeMat());
const mum = fakeMesh(fakeMat());
const wintersweet = fakeMesh(fakeMat());
const snowman = fakeGroup([fakeMesh(fakeMat()), fakeMesh(fakeMat())]);  // 雪人=Group

const anchor = new THREE.Vector3(-18, 0, 6);
initSeasons({
    grassMaterials: [grassMat],
    trees: [
        { leaves: decLeaves, type: 'deciduous', spring: SPRING, autumn: AUTUMN,
          anchor, fruits: decFruits, snow: decSnow },
        { leaves: pineLeaves, type: 'pine', spring: null, autumn: null,
          anchor, fruits: null, snow: pineSnow },
    ],
    flowerGroups: [
        { mesh: tulip, bloomIn: -0.2, bloomOut: 0.95 },
        { mesh: sunflower, bloomIn: 1.1, bloomOut: 1.9 },
        { mesh: mum, bloomIn: 1.9, bloomOut: 2.8 },
        { mesh: wintersweet, bloomIn: 2.55, bloomOut: 3.4 },
    ],
    snowman,
});

// ── 春 (0.3) ──
updateSeason(0.3);
check('春: 落叶树有叶且偏花色', decLeaves.visible && decLeaves.material.color.value !== SUMMER_LEAF);
check('春: 落叶树满冠', decLeaves.scale.s === 1);
check('春: 无果无雪无雪人', !decFruits.visible && !decSnow.visible && !snowman.visible);
check('春: 郁金香开（Group 子材质全部淡入）',
    tulip.visible && tulip.children.every(c => c.material.opacity > 0.9));
check('春: 向日葵未开', !sunflower.visible);
check('春: 花卉 Group 子材质已设为透明',
    tulip.children.every(c => c.material.transparent === true));

// ── 夏初 (1.0)：纯色基准 ──
updateSeason(1.0);
check('夏: 落叶树为夏季绿', decLeaves.material.color.value === SUMMER_LEAF);
check('夏: 草地深绿', grassMat.color.value === 0x4a8c3f);

// ── 夏 (1.4) ──
updateSeason(1.4);
check('夏: 果未熟', !decFruits.visible);
check('夏: 向日葵开', sunflower.visible && sunflower.material.opacity > 0.9);
check('夏: 郁金香谢', !tulip.visible);

// ── 秋 (2.2) ──
updateSeason(2.2);
check('秋: 叶转秋色', decLeaves.visible && decLeaves.material.color.value === AUTUMN);
check('秋: 果实满枝', decFruits.visible && decFruits.scale.s === 1);
check('秋: 果子绕锚点缩放位置正确', decFruits.position.x === 0 && decFruits.position.z === 0);
check('秋: 菊花开', mum.visible);
check('秋: 雪未落', !decSnow.visible && !pineSnow.visible);

// ── 秋末 (2.8)：果渐退、雪渐显 ──
updateSeason(2.8);
check('秋末: 果半收', decFruits.visible && decFruits.scale.s < 1 && decFruits.scale.s > 0);
check('秋末: 雪盖半显', decSnow.visible && decSnow.scale.s > 0 && decSnow.scale.s < 1);
check('秋末: 雪盖绕锚点偏移', decSnow.position.x !== 0);

// ── 冬 (3.0) ──
updateSeason(3.0);
check('冬: 落叶树光秃', !decLeaves.visible);
check('冬: 松树常青', pineLeaves.visible && pineLeaves.scale.s === 1);
check('冬: 松叶偏冬色', pineLeaves.material.color.value === 0x2e5a30);
check('冬: 果尽', !decFruits.visible);
check('冬: 雪盖满', decSnow.visible && decSnow.scale.s === 1 && pineSnow.visible);
check('冬: 雪人出现', snowman.visible && snowman.scale.s === 1);
check('冬: 腊梅开', wintersweet.visible);
check('冬: 草白', grassMat.color.value === 0xe8e8e8);

// ── 春回 (0) ──
updateSeason(0);
check('春回: 雪人消失', !snowman.visible);
check('春回: 落叶树满花色', decLeaves.visible && decLeaves.material.color.value === SPRING);

console.log(failures ? `\n${failures} 项失败` : '\n全部通过');
process.exit(failures ? 1 : 0);
