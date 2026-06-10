/**
 * 统一书本工厂函数
 * 书架上的书、边桌上的书等均为同一类物品，只是尺寸/材质/初始位置不同
 */
import * as THREE from 'three';

/**
 * 创建一本书
 * 参数约定：width=第二长边, height=最短边, depth=最长边
 * 这样 rotation.x=0 时平躺(最大面朝上下)，rotation.x=π/2 时站立(最小面朝上下)
 *
 * @param {Object} opts
 * @param {number} opts.width    - 书本宽度 (x)：第二长边
 * @param {number} opts.height   - 书本高度 (y)：最短边
 * @param {number} opts.depth    - 书本深度 (z)：最长边
 * @param {THREE.Material} opts.material - 材质
 * @param {number} opts.x        - 世界坐标 x
 * @param {number} opts.y        - 世界坐标 y
 * @param {number} opts.z        - 世界坐标 z
 * @param {number} [opts.rotationX=0] - x 轴旋转（弧度）
 * @param {number} [opts.rotationY=0] - y 轴旋转（弧度）
 * @returns {THREE.Group}
 */
export function createBook({ width, height, depth, material, x, y, z, rotationX = 0, rotationY = 0 }) {
    const bookGroup = new THREE.Group();
    const bookMesh = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, depth),
        material,
    );
    bookMesh.castShadow = true;
    bookGroup.add(bookMesh);
    bookGroup.position.set(x, y, z);
    if (rotationX) bookGroup.rotation.x = rotationX;
    if (rotationY) bookGroup.rotation.y = rotationY;
    return bookGroup;
}
