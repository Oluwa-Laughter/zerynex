/**
 * Wallet-neutral, opt-in ZIP-321 handoff coordination.
 *
 * No wallet autodiscovery, signing, RPC, broadcasting, transaction polling,
 * storage, secret logging, or automatic retry. Providers are supplied by the
 * host application and MUST be trusted independently.
 */
import type { Zip321Summary } from './browser.js'

export type WalletNetwork = 'main' | 'test' | 'regtest'

export interface WalletProviderCapabilities {
  schema_version: 1
  provider_id: string
  networks: WalletNetwork[]
  accepts_zip321: true
  max_payments: number
  supports_memos: boolean
  supports_multi_payment: boolean
}

/** Integrators implement the adapter for a trusted, supported wallet. */
export interface WalletPaymentProvider {
  getCapabilities(): Promise<unknown>
  /** Called only AFTER the host's consent callback returned true. */
  presentZip321Request(uri: string, network: WalletNetwork): Promise<unknown>
}

export interface WalletHandoffPolicy {
  expected_network: WalletNetwork
  /** Required: exact total in integer zatoshis; cannot be omitted. */
  expected_total_zat: number
  /** Default 1. A checkout must deliberately opt into multi-recipient requests. */
  max_payments?: number
  /** Default false, including transparent-only Unified Addresses. */
  allow_transparent?: boolean
  /** Default false. The host must explicitly support any memo. */
  allow_memos?: boolean
}

export interface PreparedWalletHandoff {
  readonly schema_version: 1
  readonly provider_id: string
  readonly network: WalletNetwork
  readonly payment_count: number
  readonly total_zat: number
  readonly payments: readonly Readonly<{
    index: number
    receiver_type: 'transparent' | 'shielded_or_unified'
    amount_zat: number
    memo_present: boolean
  }>[]
  readonly requires_wallet_confirmation: true
  readonly limitation: string
}

export type WalletHandoffResult =
  | Readonly<{ status: 'presented'; limitation: string }>
  | Readonly<{ status: 'cancelled'; limitation: string }>

export type WalletHandoffErrorCode =
  | 'INPUT_INVALID'
  | 'PROVIDER_UNAVAILABLE'
  | 'CAPABILITY_INVALID'
  | 'POLICY_REJECTED'
  | 'TICKET_INVALID'
  | 'CONSENT_FAILED'
  | 'PROVIDER_FAILED'
  | 'RESULT_INVALID'

export class WalletHandoffError extends Error {
  readonly code: WalletHandoffErrorCode
  constructor(code: WalletHandoffErrorCode) {
    super({
      INPUT_INVALID: 'Payment request inspection failed.',
      PROVIDER_UNAVAILABLE: 'Trusted wallet provider is unavailable.',
      CAPABILITY_INVALID: 'Wallet provider capabilities are invalid.',
      POLICY_REJECTED: 'Payment request is not permitted by this application.',
      TICKET_INVALID: 'Payment handoff ticket is invalid or already consumed.',
      CONSENT_FAILED: 'User confirmation could not be established.',
      PROVIDER_FAILED: 'Wallet provider could not open the payment request.',
      RESULT_INVALID: 'Wallet provider returned an unsupported handoff status.',
    }[code])
    this.name = 'WalletHandoffError'
    this.code = code
  }
}

const LIMITATION = 'Handoff presented to a trusted wallet, not transaction submission, user signature, confirmation, or settlement.'
const MAX_ZAT = 2_100_000_000_000_000
const MAX_URI_BYTES = 16 * 1024
const NETWORKS: readonly WalletNetwork[] = ['main', 'test', 'regtest']

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function int(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max
}

function normalizeCapabilities(data: unknown): Readonly<WalletProviderCapabilities> {
  if (!record(data) || data.schema_version !== 1 ||
      typeof data.provider_id !== 'string' || !/^[a-zA-Z0-9._-]{1,64}$/.test(data.provider_id) ||
      data.accepts_zip321 !== true || !int(data.max_payments, 1, 32) ||
      typeof data.supports_memos !== 'boolean' || typeof data.supports_multi_payment !== 'boolean' ||
      !Array.isArray(data.networks) || data.networks.length === 0 ||
      data.networks.length > 3 || new Set(data.networks).size !== data.networks.length ||
      !data.networks.every((x: unknown) => NETWORKS.includes(x as WalletNetwork)) ||
      (data.max_payments > 1 && !data.supports_multi_payment)) {
    throw new WalletHandoffError('CAPABILITY_INVALID')
  }
  return Object.freeze({
    schema_version: 1,
    provider_id: data.provider_id,
    accepts_zip321: true,
    networks: Object.freeze([...data.networks]) as unknown as WalletNetwork[],
    max_payments: data.max_payments,
    supports_memos: data.supports_memos,
    supports_multi_payment: data.supports_multi_payment,
  })
}

function normalizePolicy(data: WalletHandoffPolicy): Required<WalletHandoffPolicy> {
  if (!record(data) || Object.keys(data).some(key => ![
    'expected_network', 'expected_total_zat', 'max_payments',
    'allow_transparent', 'allow_memos',
  ].includes(key)) || !NETWORKS.includes(data.expected_network) ||
      !int(data.expected_total_zat, 1, MAX_ZAT) ||
      !int(data.max_payments ?? 1, 1, 32) ||
      typeof (data.allow_transparent ?? false) !== 'boolean' ||
      typeof (data.allow_memos ?? false) !== 'boolean') {
    throw new WalletHandoffError('POLICY_REJECTED')
  }
  return {
    expected_network: data.expected_network,
    expected_total_zat: data.expected_total_zat,
    max_payments: data.max_payments ?? 1,
    allow_transparent: data.allow_transparent ?? false,
    allow_memos: data.allow_memos ?? false,
  }
}

function inspectReport(raw: unknown, policy: Required<WalletHandoffPolicy>,
  capabilities: WalletProviderCapabilities): PreparedWalletHandoff {
  if (!record(raw) || raw.schema_version !== 1 || raw.network !== policy.expected_network ||
      !Array.isArray(raw.payments) || raw.payments.length === 0 ||
      raw.payments.length > Math.min(policy.max_payments, capabilities.max_payments) ||
      (raw.payments.length > 1 && !capabilities.supports_multi_payment) ||
      !int(raw.total_zat, 1, MAX_ZAT) || raw.total_zat !== policy.expected_total_zat ||
      typeof raw.limitation !== 'string' || raw.limitation.length > 1024) {
    throw new WalletHandoffError('POLICY_REJECTED')
  }
  const seen = new Set<number>()
  let sum = 0
  const payments: PreparedWalletHandoff['payments'][number][] = []
  for (const item of raw.payments) {
    if (!record(item) || !int(item.index, 0, 9999) || seen.has(item.index) ||
        (item.address_type !== 'transparent' && item.address_type !== 'shielded_or_unified') ||
        !int(item.amount_zat, 1, MAX_ZAT) ||
        typeof item.memo_present !== 'boolean' || typeof item.label_present !== 'boolean' ||
        typeof item.message_present !== 'boolean' ||
        (item.address_type === 'transparent' && !policy.allow_transparent) ||
        (item.memo_present && (!policy.allow_memos || !capabilities.supports_memos))) {
      throw new WalletHandoffError('POLICY_REJECTED')
    }
    seen.add(item.index)
    sum += item.amount_zat
    if (!Number.isSafeInteger(sum) || sum > MAX_ZAT) throw new WalletHandoffError('POLICY_REJECTED')
    payments.push(Object.freeze({
      index: item.index, receiver_type: item.address_type,
      amount_zat: item.amount_zat, memo_present: item.memo_present,
    }))
  }
  if (sum !== policy.expected_total_zat) throw new WalletHandoffError('POLICY_REJECTED')
  return Object.freeze({
    schema_version: 1, provider_id: capabilities.provider_id,
    network: policy.expected_network, payment_count: payments.length,
    total_zat: sum, payments: Object.freeze(payments),
    requires_wallet_confirmation: true,
    limitation: 'Locally checked ZIP-321 format and checkout policy only; the wallet must independently show and verify recipients, fee, and transaction details.',
  })
}

export interface WalletHandoffCoordinator {
  getCapabilities(): Promise<Readonly<WalletProviderCapabilities>>
  /** URI is retained privately only until one handoff or explicit cancel. */
  prepare(uri: string, policy: WalletHandoffPolicy): Promise<PreparedWalletHandoff>
  /** Revokes a prepared ticket. Returns false for unknown/already-consumed tickets. */
  cancel(ticket: PreparedWalletHandoff): boolean
  /**
   * Call from a real user interaction. Host-supplied authorization MUST show
   * full recipients and amounts and obtain consent. A boolean is not proof of
   * user activation: integrations must implement that themselves.
   */
  handoff(ticket: PreparedWalletHandoff,
    authorize: (review: PreparedWalletHandoff) => Promise<boolean>): Promise<WalletHandoffResult>
}

/** The inspector must be the genuine trusted local Rust/WASM ZIP-321 parser. */
export function createWalletHandoffCoordinator(
  provider: WalletPaymentProvider,
  inspector: (uri: string, network: WalletNetwork) => Promise<Zip321Summary>,
): WalletHandoffCoordinator {
  if (!provider || typeof provider.getCapabilities !== 'function' ||
      typeof provider.presentZip321Request !== 'function' || typeof inspector !== 'function') {
    throw new WalletHandoffError('PROVIDER_UNAVAILABLE')
  }
  const tickets = new WeakMap<PreparedWalletHandoff, {
    uri: string, policy: Required<WalletHandoffPolicy>
  }>()

  async function getCapabilities() {
    let raw: unknown
    try { raw = await provider.getCapabilities() }
    catch { throw new WalletHandoffError('PROVIDER_UNAVAILABLE') }
    return normalizeCapabilities(raw)
  }

  return {
    getCapabilities,
    async prepare(uri, rawPolicy) {
      const policy = normalizePolicy(rawPolicy)
      if (typeof uri !== 'string' || uri.length === 0 ||
          new TextEncoder().encode(uri).length > MAX_URI_BYTES || !uri.startsWith('zcash:')) {
        throw new WalletHandoffError('INPUT_INVALID')
      }
      const caps = await getCapabilities()
      if (!caps.networks.includes(policy.expected_network)) {
        throw new WalletHandoffError('CAPABILITY_INVALID')
      }
      let report: Zip321Summary
      try { report = await inspector(uri, policy.expected_network) }
      catch { throw new WalletHandoffError('INPUT_INVALID') }
      const review = inspectReport(report, policy, caps)
      tickets.set(review, { uri, policy })
      return review
    },
    cancel(ticket) {
      return record(ticket) && tickets.delete(ticket as PreparedWalletHandoff)
    },
    async handoff(ticket, authorize) {
      if (!record(ticket) || !tickets.has(ticket)) {
        throw new WalletHandoffError('TICKET_INVALID')
      }
      const saved = tickets.get(ticket)!
      // Consume synchronously, BEFORE awaiting capability checks or consent.
      tickets.delete(ticket)
      if (typeof authorize !== 'function') throw new WalletHandoffError('CONSENT_FAILED')
      const caps = await getCapabilities()
      if (caps.provider_id !== ticket.provider_id ||
          !caps.networks.includes(saved.policy.expected_network) ||
          caps.max_payments < ticket.payment_count ||
          (ticket.payment_count > 1 && !caps.supports_multi_payment) ||
          (ticket.payments.some(x => x.memo_present) && !caps.supports_memos)) {
        throw new WalletHandoffError('CAPABILITY_INVALID')
      }
      let consent: unknown
      try { consent = await authorize(ticket) }
      catch { throw new WalletHandoffError('CONSENT_FAILED') }
      if (consent !== true) {
        if (consent === false) return Object.freeze({ status: 'cancelled' as const, limitation: LIMITATION })
        throw new WalletHandoffError('CONSENT_FAILED')
      }
      let response: unknown
      try { response = await provider.presentZip321Request(saved.uri, saved.policy.expected_network) }
      catch { throw new WalletHandoffError('PROVIDER_FAILED') }
      if (!record(response) || Object.keys(response).length !== 1 ||
          (response.status !== 'presented' && response.status !== 'cancelled')) {
        throw new WalletHandoffError('RESULT_INVALID')
      }
      return Object.freeze({ status: response.status, limitation: LIMITATION })
    },
  }
}

/**
 * Explicit OS deep-link adapter. The host supplies openUri (typically via a
 * browser user-gesture handler). It cannot detect installed wallets or attest
 * that any wallet accepted the request. Declare only capabilities verified
 * by the integrator for the target wallet.
 */
export function createZip321UriProvider(config: {
  network: WalletNetwork
  openUri: (uri: string) => void | Promise<void>
  provider_id?: string
  max_payments?: number
  supports_memos?: boolean
}): WalletPaymentProvider {
  if (!record(config) || !NETWORKS.includes(config.network) ||
      typeof config.openUri !== 'function') {
    throw new WalletHandoffError('CAPABILITY_INVALID')
  }
  const caps = normalizeCapabilities({
    schema_version: 1, provider_id: config.provider_id ?? 'zip321-uri',
    networks: [config.network], accepts_zip321: true,
    max_payments: config.max_payments ?? 1,
    supports_memos: config.supports_memos ?? false,
    supports_multi_payment: (config.max_payments ?? 1) > 1,
  })
  return {
    async getCapabilities() { return caps },
    async presentZip321Request(uri, network) {
      if (network !== config.network || typeof uri !== 'string' ||
          !uri.startsWith('zcash:') || new TextEncoder().encode(uri).length > MAX_URI_BYTES) {
        throw new WalletHandoffError('INPUT_INVALID')
      }
      await config.openUri(uri)
      // An attempted OS URI launch is NOT a wallet acknowledgement.
      return { status: 'presented' }
    },
  }
}
