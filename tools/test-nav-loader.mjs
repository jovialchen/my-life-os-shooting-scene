// test-nav.mjs 的 ESM resolve hook：把 'three' 重定向到 tools/three-stub.mjs
export async function resolve(specifier, context, nextResolve) {
    if (specifier === 'three') {
        return nextResolve(new URL('./three-stub.mjs', import.meta.url).href, context);
    }
    return nextResolve(specifier, context);
}
