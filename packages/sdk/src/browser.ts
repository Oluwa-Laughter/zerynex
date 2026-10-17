/**
 * Distribution-ready client: ship the canonical Rust/WASM engine WITH the
 * package. The user's app does not need Cargo, wasm-bindgen or a repo clone.
 *
 * The caller may provide trusted preloaded wasm bytes, a Response, or a URL.
 * Without an explicit source, wasm-bindgen loads its adjacent package asset.
 * A host bundler must correctly serve .wasm with application/wasm MIME type.
 */
import { createZerynexClient, type ZerynexClient } from './index.js'
import init, { analyze_pczt_policy, compare_pczt_stages, type InitInput } from './wasm/zerynex.js'

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
