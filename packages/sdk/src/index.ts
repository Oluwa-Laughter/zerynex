/**
 * Zerynex SDK: local PCZT privacy-policy analysis powered by Zcash Rust/WASM.
 *
 * The host supplies an initialized local WASM engine. No upload, network
 * request, key custody or transaction broadcast is performed by this SDK.
 * Reports describe only selected disclosure-policy checks, not anonymity.
 */

export type Profile = 'external_signer' | 'restricted_handoff'

export interface Policy {
  profile: Profile
  deny_transparent: boolean
  deny_sapling: boolean
}

export interface Finding {
  rule: string
  field: string
  explanation: string
}

export interface Report {
  profile: Profile
  deny_transparent: boolean
  deny_sapling: boolean
  findings: Finding[]
  checked_pools: string[]
  disclaimer: string
}

export type PartialPolicy = Partial<Policy>

/**
 * Minimum method exposed by the official Zerynex WASM bindings.
 * Any supplied engine MUST be trusted local code; the SDK does not audit it.
 */
export interface ZerynexEngine {
  analyze_pczt_policy(input: Uint8Array, policyJson: string): string
}

export interface ClientOptions {
  /** Load an ALREADY initialized local WASM module. */
  loadEngine: () => Promise<ZerynexEngine>
  /** Input size limit. Maximum 8 MiB to mirror the Rust CLI. */
  maxInputBytes?: number
}

export type SdkErrorCode = 'INPUT_INVALID' | 'POLICY_INVALID' | 'ENGINE_UNAVAILABLE' | 'ANALYSIS_FAILED' | 'REPORT_INVALID'

export class ZerynexSdkError extends Error {
  readonly code: SdkErrorCode

  constructor(code: SdkErrorCode, message: string) {
    super(message)
    this.name = 'ZerynexSdkError'
    this.code = code
  }
}

export const DEFAULT_POLICY: Readonly<Policy> = Object.freeze({
  profile: 'external_signer',
  deny_transparent: false,
  deny_sapling: false,
})

export const MAX_PCZT_BYTES = 8 * 1024 * 1024

/** Reject unknown policy settings so typos cannot silently weaken policies. */
export function normalizePolicy(input: PartialPolicy = {}): Policy {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new ZerynexSdkError('POLICY_INVALID', 'Invalid policy object.')
  }
  const keys = Object.keys(input)
  if (keys.some(key => !['profile', 'deny_transparent', 'deny_sapling'].includes(key))) {
    throw new ZerynexSdkError('POLICY_INVALID', 'Unrecognized privacy policy option.')
  }
  const profile = input.profile ?? DEFAULT_POLICY.profile
  const deny_transparent = input.deny_transparent ?? DEFAULT_POLICY.deny_transparent
  const deny_sapling = input.deny_sapling ?? DEFAULT_POLICY.deny_sapling
  if ((profile !== 'external_signer' && profile !== 'restricted_handoff') ||
    typeof deny_transparent !== 'boolean' || typeof deny_sapling !== 'boolean') {
    throw new ZerynexSdkError('POLICY_INVALID', 'Invalid privacy policy option.')
  }
  return { profile, deny_transparent, deny_sapling }
}

export function exportPolicyJson(policy: PartialPolicy = {}): string {
  return JSON.stringify(normalizePolicy(policy), null, 2)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFinding(value: unknown): value is Finding {
  return isRecord(value) && typeof value.rule === 'string' &&
    typeof value.field === 'string' && typeof value.explanation === 'string'
}

function parseReport(text: string): Report {
  let output: unknown
  try {
    output = JSON.parse(text)
  } catch {
    throw new ZerynexSdkError('REPORT_INVALID', 'Local analysis returned an invalid report.')
  }
  if (!isRecord(output) ||
    (output.profile !== 'external_signer' && output.profile !== 'restricted_handoff') ||
    typeof output.deny_transparent !== 'boolean' ||
    typeof output.deny_sapling !== 'boolean' ||
    !Array.isArray(output.findings) || !output.findings.every(isFinding) ||
    !Array.isArray(output.checked_pools) ||
    !output.checked_pools.every((entry: unknown) => typeof entry === 'string') ||
    typeof output.disclaimer !== 'string') {
    throw new ZerynexSdkError('REPORT_INVALID', 'Local analysis returned an invalid report.')
  }
  return output as unknown as Report
}

export interface ZerynexClient {
  /** Lazily load the local engine, at most once per successful initialization. */
  ready(): Promise<void>
  /** Analyze bytes strictly on this device. */
  analyzeBytes(input: Uint8Array | ArrayBuffer, policy?: PartialPolicy): Promise<Report>
  /** Analyze local browser File and Blob objects. */
  analyzeBlob(input: Blob, policy?: PartialPolicy): Promise<Report>
}

export function createZerynexClient(options: ClientOptions): ZerynexClient {
  if (!options || typeof options.loadEngine !== 'function') {
    throw new ZerynexSdkError('ENGINE_UNAVAILABLE', 'A local WASM engine loader is required.')
  }
  const maxInputBytes = options.maxInputBytes ?? MAX_PCZT_BYTES
  if (!Number.isSafeInteger(maxInputBytes) || maxInputBytes < 1 || maxInputBytes > MAX_PCZT_BYTES) {
    throw new ZerynexSdkError('INPUT_INVALID', 'Invalid maximum PCZT file size.')
  }

  let enginePromise: Promise<ZerynexEngine> | undefined
  function load(): Promise<ZerynexEngine> {
    if (!enginePromise) {
      enginePromise = Promise.resolve()
        .then(options.loadEngine)
        .then(engine => {
          if (!engine || typeof engine.analyze_pczt_policy !== 'function') {
            throw new Error('Invalid engine')
          }
          return engine
        })
        .catch(() => {
          enginePromise = undefined
          throw new ZerynexSdkError('ENGINE_UNAVAILABLE', 'Local Rust analysis engine is unavailable.')
        })
    }
    return enginePromise
  }

  function validateSize(size: number): void {
    if (!Number.isSafeInteger(size) || size === 0 || size > maxInputBytes) {
      throw new ZerynexSdkError('INPUT_INVALID', 'Expected a nonempty binary PCZT of at most 8 MiB.')
    }
  }

  async function analyzeBytes(input: Uint8Array | ArrayBuffer, policy: PartialPolicy = {}): Promise<Report> {
    const configured = normalizePolicy(policy)
    if (!(input instanceof Uint8Array) && !(input instanceof ArrayBuffer)) {
      throw new ZerynexSdkError('INPUT_INVALID', 'Expected binary PCZT data.')
    }
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input)
    validateSize(bytes.byteLength)
    const engine = await load()
    let result: string
    try {
      result = engine.analyze_pczt_policy(bytes, JSON.stringify(configured))
    } catch {
      // Never echo WASM exception payloads: they might contain sensitive data.
      throw new ZerynexSdkError('ANALYSIS_FAILED', 'Unable to inspect the selected PCZT.')
    }
    return parseReport(result)
  }

  async function analyzeBlob(input: Blob, policy: PartialPolicy = {}): Promise<Report> {
    if (!input || typeof input.arrayBuffer !== 'function' || typeof input.size !== 'number') {
      throw new ZerynexSdkError('INPUT_INVALID', 'Expected a local file or Blob.')
    }
    validateSize(input.size)
    const normalized = normalizePolicy(policy)
    return analyzeBytes(await input.arrayBuffer(), normalized)
  }

  return {
    ready: async () => { await load() },
    analyzeBytes,
    analyzeBlob,
  }
}
