export { createWalletHandoffCoordinator, createZip321UriProvider, WalletHandoffError } from './wallet-handoff.js'
export type { WalletNetwork, WalletProviderCapabilities, WalletPaymentProvider, WalletHandoffPolicy, PreparedWalletHandoff, WalletHandoffCoordinator, WalletHandoffResult, WalletHandoffErrorCode } from './wallet-handoff.js'
export { evaluateZcashNodeStatus } from './network.js'
export type { NodeReadiness, ZcashNetwork, NodeCheckCode, NodeCheckStatus } from './network.js'
export { RULE_CATALOG, getRule } from './rule-catalog.js'
export type { RuleId, RuleDefinition } from './rule-catalog.js'

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

export interface StageFinding {
  rule: string
  field: string
}

export interface ComponentDelta {
  component: string
  before: number
  after: number
}

export interface StageComparison {
  profile: Profile
  deny_transparent: boolean
  deny_sapling: boolean
  before_findings_count: number
  after_findings_count: number
  added_findings: StageFinding[]
  resolved_findings: StageFinding[]
  component_deltas: ComponentDelta[]
  no_new_findings: boolean
  passed: boolean
  disclaimer: string
}

export type PartialPolicy = Partial<Policy>

/**
 * Minimum method exposed by the official Zerynex WASM bindings.
 * Any supplied engine MUST be trusted local code; the SDK does not audit it.
 */
export interface ZerynexEngine {
  analyze_pczt_policy(input: Uint8Array, policyJson: string): string
  /** Optional for older engines; required by the comparison methods. */
  compare_pczt_stages?(before: Uint8Array, after: Uint8Array, policyJson: string): string
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

/** Import a repository-local policy without accepting unknown or loose fields. */
export function parsePolicyJson(contents: string): Policy {
  if (typeof contents !== 'string' || new TextEncoder().encode(contents).byteLength > 4096) {
    throw new ZerynexSdkError('POLICY_INVALID', 'Policy file must be valid JSON of at most 4 KiB.')
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(contents)
  } catch {
    throw new ZerynexSdkError('POLICY_INVALID', 'Policy file is not valid JSON.')
  }
  if (!isRecord(parsed)) {
    throw new ZerynexSdkError('POLICY_INVALID', 'Policy file must contain a JSON object.')
  }
  return normalizePolicy(parsed)
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

function isStageFinding(value: unknown): value is StageFinding {
  return isRecord(value) && typeof value.rule === 'string' && value.rule.length > 0 &&
    value.rule.length <= 500 && typeof value.field === 'string' &&
    value.field.length > 0 && value.field.length <= 500
}

function isComponentDelta(value: unknown): value is ComponentDelta {
  return isRecord(value) &&
    ['transparent.inputs', 'transparent.outputs', 'sapling.spends', 'sapling.outputs',
      'orchard.actions', 'ironwood.actions'].includes(String(value.component)) &&
    Number.isSafeInteger(value.before) && Number(value.before) >= 0 &&
    Number.isSafeInteger(value.after) && Number(value.after) >= 0
}

function parseStageComparison(text: string, policy: Policy): StageComparison {
  if (text.length > 256 * 1024) {
    throw new ZerynexSdkError('REPORT_INVALID', 'Local stage report exceeds output size.')
  }
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new ZerynexSdkError('REPORT_INVALID', 'Local stage comparison returned invalid JSON.')
  }
  if (!isRecord(value) ||
    value.profile !== policy.profile ||
    value.deny_transparent !== policy.deny_transparent ||
    value.deny_sapling !== policy.deny_sapling ||
    !Number.isSafeInteger(value.before_findings_count) || Number(value.before_findings_count) < 0 ||
    !Number.isSafeInteger(value.after_findings_count) || Number(value.after_findings_count) < 0 ||
    !Array.isArray(value.added_findings) || value.added_findings.length > 1000 ||
    !value.added_findings.every(isStageFinding) ||
    !Array.isArray(value.resolved_findings) || value.resolved_findings.length > 1000 ||
    !value.resolved_findings.every(isStageFinding) ||
    !Array.isArray(value.component_deltas) || value.component_deltas.length > 6 ||
    !value.component_deltas.every(isComponentDelta) ||
    typeof value.no_new_findings !== 'boolean' || typeof value.passed !== 'boolean' ||
    typeof value.disclaimer !== 'string' || !value.disclaimer ||
    value.no_new_findings !== (value.added_findings.length === 0) ||
    value.passed !== (value.after_findings_count === 0 &&
      value.added_findings.length === 0 && value.component_deltas.length === 0)) {
    throw new ZerynexSdkError('REPORT_INVALID', 'Local stage comparison returned an invalid report.')
  }
  return value as unknown as StageComparison
}

export interface ZerynexClient {
  /** Lazily load the local engine, at most once per successful initialization. */
  ready(): Promise<void>
  /** Analyze bytes strictly on this device. */
  analyzeBytes(input: Uint8Array | ArrayBuffer, policy?: PartialPolicy): Promise<Report>
  /** Analyze local browser File and Blob objects. */
  analyzeBlob(input: Blob, policy?: PartialPolicy): Promise<Report>
  /** Compare two locally held binary PCZT snapshots with the SAME Rust engine. */
  compareStages(before: Uint8Array | ArrayBuffer, after: Uint8Array | ArrayBuffer,
    policy?: PartialPolicy): Promise<StageComparison>
  /** Compare local browser files, without uploading either snapshot. */
  compareStageBlobs(before: Blob, after: Blob, policy?: PartialPolicy): Promise<StageComparison>
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

  async function compareStages(before: Uint8Array | ArrayBuffer, after: Uint8Array | ArrayBuffer,
    policy: PartialPolicy = {}): Promise<StageComparison> {
    const configured = normalizePolicy(policy)
    if (!(before instanceof Uint8Array) && !(before instanceof ArrayBuffer) ||
        !(after instanceof Uint8Array) && !(after instanceof ArrayBuffer)) {
      throw new ZerynexSdkError('INPUT_INVALID', 'Expected two binary PCZT snapshots.')
    }
    const first = before instanceof Uint8Array ? before : new Uint8Array(before)
    const second = after instanceof Uint8Array ? after : new Uint8Array(after)
    validateSize(first.byteLength)
    validateSize(second.byteLength)
    const engine = await load()
    if (typeof engine.compare_pczt_stages !== 'function') {
      throw new ZerynexSdkError('ENGINE_UNAVAILABLE', 'Local Rust engine cannot compare stages.')
    }
    let report: string
    try {
      report = engine.compare_pczt_stages(first, second, JSON.stringify(configured))
    } catch {
      throw new ZerynexSdkError('ANALYSIS_FAILED', 'Unable to compare selected PCZT stages.')
    }
    return parseStageComparison(report, configured)
  }

  async function compareStageBlobs(before: Blob, after: Blob, policy: PartialPolicy = {}): Promise<StageComparison> {
    if (!before || !after || typeof before.arrayBuffer !== 'function' ||
      typeof after.arrayBuffer !== 'function' || !Number.isSafeInteger(before.size) ||
      !Number.isSafeInteger(after.size)) {
      throw new ZerynexSdkError('INPUT_INVALID', 'Expected two local PCZT files.')
    }
    validateSize(before.size)
    validateSize(after.size)
    const configured = normalizePolicy(policy)
    return compareStages(await before.arrayBuffer(), await after.arrayBuffer(), configured)
  }

  return {
    ready: async () => { await load() },
    analyzeBytes,
    analyzeBlob,
    compareStages,
    compareStageBlobs,
  }
}
