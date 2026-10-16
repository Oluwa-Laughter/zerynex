// One trusted local Rust/WebAssembly instance shared across Studio sessions.
// The reusable package owns policy validation, error redaction, and file analysis.
// The Next.js application only supplies the WASM loader; no PCZT upload APIs.
import {
  createZerynexClient,
  type Profile as SdkProfile,
  type Report,
  type StageComparison,
} from '@zerynex/sdk'

export type Profile = 'external-signer' | 'restricted-handoff'
export type { Report, StageComparison } from '@zerynex/sdk'
export type PolicyOptions = { denyTransparent: boolean; denySapling: boolean }

const client = createZerynexClient({
  loadEngine: async () => {
    const wasm = await import('./wasm/zerynex.js')
    await wasm.default({ module_or_path: '/wasm/zerynex_bg.wasm' })
    return { analyze_pczt_policy: wasm.analyze_pczt_policy, compare_pczt_stages: wasm.compare_pczt_stages }
  },
})

export async function loadEngine(): Promise<void> {
  await client.ready()
}

export async function inspectPczt(
  file: File,
  profile: Profile,
  options: PolicyOptions,
): Promise<Report> {
  const normalizedProfile: SdkProfile =
    profile === 'restricted-handoff' ? 'restricted_handoff' : 'external_signer'

  return client.analyzeBlob(file, {
    profile: normalizedProfile,
    deny_transparent: options.denyTransparent,
    deny_sapling: options.denySapling,
  })
}

/** A source-file-only, browser local comparison; no API routes or storage. */
export async function comparePcztFiles(
  baseline: Blob, candidate: Blob, profile: Profile, options: PolicyOptions,
): Promise<StageComparison> {
  return client.compareStageBlobs(baseline, candidate, {
    profile: profile === 'restricted-handoff' ? 'restricted_handoff' : 'external_signer',
    deny_transparent: options.denyTransparent,
    deny_sapling: options.denySapling,
  })
}
