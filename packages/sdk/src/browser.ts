/**
 * Distribution-ready client: ship the canonical Rust/WASM engine WITH the
 * package. The user's app does not need Cargo, wasm-bindgen or a repo clone.
 *
 * The caller may provide trusted preloaded wasm bytes, a Response, or a URL.
 * Without an explicit source, wasm-bindgen loads its adjacent package asset.
 * A host bundler must correctly serve .wasm with application/wasm MIME type.
 */
import { createZerynexClient, type ZerynexClient } from './index.js'
import { createWalletHandoffCoordinator, type WalletPaymentProvider, type WalletHandoffCoordinator } from './wallet-handoff.js'
import init, { analyze_pczt_policy, compare_pczt_stages, inspect_zip321_request, type InitInput } from './wasm/zerynex.js'

export interface BrowserClientOptions {
  /** Explicit trusted WASM asset source, if host bundler cannot serve it. */
  wasm?: InitInput
  /** Optional lower per-application input limit, at most 8 MiB. */
  maxInputBytes?: number
}

export function createBrowserZerynexClient(options: BrowserClientOptions = {}): ZerynexClient {
  return createZerynexClient({
    maxInputBytes: options.maxInputBytes,
    loadEngine: async () => {
      if (options.wasm === undefined) {
        await init()
      } else {
        await init({ module_or_path: options.wasm })
      }
      return { analyze_pczt_policy, compare_pczt_stages }
    },
  })
}

/** Redacted ZIP-321 summary from the canonical Rust/WASM parser. */
export interface Zip321Summary {
  schema_version: 1
  network: 'main' | 'test' | 'regtest'
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

/**
 * Inspect a ZIP-321 URI in local Rust/WASM. This never sends the URI over the
 * network or exposes its recipient addresses and memo content in the result.
 * Passing a trusted WASM source avoids implicit package asset resolution.
 */
export async function inspectZip321Uri(
  uri: string,
  network: 'main' | 'test' | 'regtest',
  options: BrowserClientOptions = {},
): Promise<Zip321Summary> {
  if (typeof uri !== 'string' || uri.length === 0 || new TextEncoder().encode(uri).length > 16384 ||
      !(['main', 'test', 'regtest'] as string[]).includes(network)) {
    throw new Error('Invalid ZIP-321 URI or expected network')
  }
  try {
    if (options.wasm === undefined) await init()
    else await init({ module_or_path: options.wasm })
    const report: unknown = JSON.parse(inspect_zip321_request(uri, network))
    if (!report || typeof report !== 'object' || Array.isArray(report)) throw Error()
    const value = report as Record<string,unknown>
    if (value.schema_version !== 1 || value.network !== network || !Array.isArray(value.payments) ||
        value.payments.length === 0 || value.payments.length > 32 || typeof value.limitation !== 'string' ||
        !value.payments.every(item => item && typeof item === 'object' &&
          Number.isSafeInteger(item.index) && typeof item.address_type === 'string' &&
          (item.amount_zat === null || (Number.isSafeInteger(item.amount_zat) && item.amount_zat >= 0)) &&
          typeof item.memo_present === 'boolean' && typeof item.label_present === 'boolean' &&
          typeof item.message_present === 'boolean')) throw Error()
    return report as Zip321Summary
  } catch {
    throw new Error('ZIP-321 input rejected or trusted Rust/WASM engine unavailable')
  }
}

/** Rust/WASM-backed, opt-in, one-use wallet handoff coordinator. */
export function createBrowserWalletHandoff(
  provider: WalletPaymentProvider,
  options: BrowserClientOptions = {},
): WalletHandoffCoordinator {
  return createWalletHandoffCoordinator(provider,
    (uri, network) => inspectZip321Uri(uri, network, options))
}
export { createZip321UriProvider } from './wallet-handoff.js'
export type { WalletPaymentProvider, WalletHandoffPolicy, PreparedWalletHandoff, WalletHandoffResult } from './wallet-handoff.js'
