// Real Zcash PCZT inspection uses the exact Rust engine compiled to WebAssembly.
// It runs locally in the browser; a PCZT is NEVER transmitted to our backend.
export type Profile = 'external-signer' | 'restricted-handoff'
export type Finding = { rule: string; field: string; explanation: string }
export type Report = {
  profile: string
  findings: Finding[]
  checked_pools: string[]
  disclaimer: string
}
type WasmModule = {
  default: (input?: RequestInfo | URL | BufferSource | WebAssembly.Module) => Promise<unknown>
  analyze_pczt: (bytes: Uint8Array, restricted: boolean) => string
}
let loaded: Promise<WasmModule> | undefined
export function loadEngine(): Promise<WasmModule> {
  if (!loaded) {
    const runtimePath = '/wasm/zerynex.js'
    loaded = import(/* @vite-ignore */ runtimePath)
      .then(async (module) => {
        const wasm = module as WasmModule
        await wasm.default('/wasm/zerynex_bg.wasm')
        return wasm
      })
      .catch((error: unknown) => {
        loaded = undefined
        throw error
      })
  }
  return loaded
}
export async function inspectPczt(file: File, profile: Profile): Promise<Report> {
  if (file.size > 8 * 1024 * 1024) {
    throw new Error('Maximum PCZT size is 8 MiB.')
  }
  const wasm = await loadEngine()
  const buffer = await file.arrayBuffer()
  const text = wasm.analyze_pczt(new Uint8Array(buffer), profile === 'restricted-handoff')
  const result: unknown = JSON.parse(text)
  if (!isReport(result)) {
    throw new Error('The local analysis engine returned an unexpected report.')
  }
  return result
}
function isReport(value: unknown): value is Report {
  return typeof value === 'object' && value !== null && 'findings' in value &&
    Array.isArray((value as Report).findings) && 'profile' in value &&
    typeof (value as Report).profile === 'string'
}
