// three.js 的最小桩实现 —— 仅供 tools/test-nav.mjs 在 Node 下测试 pathfinding.js
// 只实现 pathfinding.js 用到的 API，且 matrixWorld 一律按单位矩阵处理

export class Vector3 {
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
    clone() { return new Vector3(this.x, this.y, this.z); }
    copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
    subVectors(a, b) { this.x = a.x - b.x; this.y = a.y - b.y; this.z = a.z - b.z; return this; }
    fromBufferAttribute(attr, i) { this.x = attr.getX(i); this.y = attr.getY(i); this.z = attr.getZ(i); return this; }
    applyMatrix4() { return this; }   // 测试里 mesh 不做变换
}

export class Box3 {
    constructor() {
        this.min = new Vector3(Infinity, Infinity, Infinity);
        this.max = new Vector3(-Infinity, -Infinity, -Infinity);
    }
    isEmpty() {
        return this.max.x < this.min.x || this.max.y < this.min.y || this.max.z < this.min.z;
    }
    union(b) {
        this.min.x = Math.min(this.min.x, b.min.x);
        this.min.y = Math.min(this.min.y, b.min.y);
        this.min.z = Math.min(this.min.z, b.min.z);
        this.max.x = Math.max(this.max.x, b.max.x);
        this.max.y = Math.max(this.max.y, b.max.y);
        this.max.z = Math.max(this.max.z, b.max.z);
        return this;
    }
    setFromObject(obj) {
        const p = obj.geometry.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
            this.min.x = Math.min(this.min.x, x);
            this.min.y = Math.min(this.min.y, y);
            this.min.z = Math.min(this.min.z, z);
            this.max.x = Math.max(this.max.x, x);
            this.max.y = Math.max(this.max.y, y);
            this.max.z = Math.max(this.max.z, z);
        }
        return this;
    }
}

export const MathUtils = {
    clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)),
    degToRad: (d) => d * Math.PI / 180,
};
