// Hosted workbench adapter: use the already-generated local Rust/WASM engine.
// No server-side URI processing, RPC, signing, or transaction broadcast.
export type Zip321Network = 'main' | 'test' | 'regtest'
export interface Zip321Summary {
  schema_version: 1
  network: Zip321Network
  payments: Array<{
    index: number
    address_type: string
    amount_zat: number | null
    memo_present: boolean
    label_present: boolean
    message_present: boolean
  }>
  total_zat: number | null
  limitation: string
}
let loader: Promise<typeof import('./wasm/zerynex.js')> | null = null
async function engine() {
  if (!loader) {
    loader = import('./wasm/zerynex.js').then(async wasm => {
      await wasm.default({ module_or_path: '/wasm/zerynex_bg.wasm' })
      return wasm
    }).catch(() => {
      loader = null
      throw new Error('Trusted local Rust/WASM engine unavailable')
    })
  }
  return loader
}
/** Structural metadata only: never returns the recipient addresses or memo. */
export async function inspectPaymentUri(uri: string, network: Zip321Network): Promise<Zip321Summary> {
  if (typeof uri !== 'string' || uri.length === 0 ||
      new TextEncoder().encode(uri).length > 16384 ||
      !(['main', 'test', 'regtest'] as string[]).includes(network)) {
    throw new Error('Unsupported ZIP-321 input')
  }
  try {
    const wasm = await engine()
    const data: unknown = JSON.parse(wasm.inspect_zip321_request(uri, network))
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error()
    const report = data as Record<string, unknown>
    if (report.schema_version !== 1 || report.network !== network ||
        !Array.isArray(report.payments) || report.payments.length === 0 ||
        report.payments.length > 32 || typeof report.limitation !== 'string' ||
        !report.payments.every(item => item && typeof item === 'object' &&
          Number.isSafeInteger(item.index) && typeof item.address_type === 'string' &&
          (item.amount_zat === null || (Number.isSafeInteger(item.amount_zat) && item.amount_zat >= 0)) &&
          typeof item.memo_present === 'boolean' &&
          typeof item.label_present === 'boolean' &&
          typeof item.message_present === 'boolean')) throw Error()
    return report as unknown as Zip321Summary
  } catch {
    throw new Error('Invalid ZIP-321 request or unavailable local Rust engine')
  }
}
