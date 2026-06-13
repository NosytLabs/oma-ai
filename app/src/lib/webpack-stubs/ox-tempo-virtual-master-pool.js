// Stub for mppx/ox/_esm/tempo/internal/virtualMasterPool.js
// The real module dynamically imports 'node:worker_threads' and spins up a
// WASM-based mining pool for the Tempo chain (Coinbase L2). Webpack cannot
// statically analyze that dynamic import, so the bundle resolves to undefined
// at runtime and `.call()` on undefined crashes the entire React tree.
//
// We do not use the Tempo chain in the OMA wagmi config (only `base` and
// `baseSepolia`), so a no-op stub is safe. The exported `resolve()` returns
// undefined to disable the mining pool; the other functions are no-ops so
// any import that doesn't await `resolve()` still gets a defined function.
export async function resolve() {
  return undefined;
}
export async function resolveNode() {
  return undefined;
}
export async function resolveBrowser() {
  return undefined;
}
export const resolveCached = undefined;
