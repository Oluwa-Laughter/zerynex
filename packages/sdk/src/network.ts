/**
 * Read-only Zcash node readiness normalization. No networking, auth, signing,
 * wallet access or transaction content. Feed only getblockchaininfo RESULT.
 * Accepts Zebra/zcashd field differences and fails closed on missing data.
 */
export type ZcashNetwork = 'main' | 'test' | 'regtest'
export type NodeCheckCode = 'NETWORK_MATCH' | 'CHAIN_HEIGHT' | 'HEADER_LAG' | 'INITIAL_SYNC' | 'VERIFICATION_PROGRESS'
export type NodeCheckStatus = 'pass' | 'fail' | 'unknown'
export interface NodeReadiness {
  schema_version: 1
  network: ZcashNetwork | null
  expected_network: ZcashNetwork
  height: number | null
  headers: number | null
  header_lag: number | null
  initial_sync_complete: boolean | null
  verification_progress: number | null
  ready: boolean
  checks: {code: NodeCheckCode, status: NodeCheckStatus}[]
  limitation: string
}
const LIMITATION = 'Local JSON-RPC chain-state observation only; not wallet readiness, spend authority, Zallet compatibility, consensus audit, or privacy proof.'
const NETWORKS = ['main', 'test', 'regtest'] as const
const height = (val: unknown): number | null => typeof val === 'number' && Number.isSafeInteger(val) && val >= 0 && val <= 4294967295 ? val : null

export function evaluateZcashNodeStatus(
  result: unknown,
  options: {expectedNetwork?: ZcashNetwork, maxHeaderLag?: number, minVerificationProgress?: number} = {},
): NodeReadiness {
  const expected_network = options.expectedNetwork ?? 'test'
  const maxHeaderLag = options.maxHeaderLag ?? 2
  const threshold = options.minVerificationProgress ?? .999
  if (!NETWORKS.includes(expected_network) || !Number.isInteger(maxHeaderLag) || maxHeaderLag < 0 || maxHeaderLag > 1000 ||
      !Number.isFinite(threshold) || threshold <= 0 || threshold > 1)
    throw new TypeError('Invalid Zcash node readiness policy')
  if (!result || typeof result !== 'object' || Array.isArray(result))
    throw new TypeError('Invalid Zcash getblockchaininfo result')
  const data = result as Record<string, unknown>
  const network = typeof data.chain === 'string' && NETWORKS.includes(data.chain as ZcashNetwork)
    ? data.chain as ZcashNetwork : null
  const block_height = height(data.blocks)
  const header_height = height(data.headers)
  const header_lag = block_height === null || header_height === null ? null : Math.max(0, header_height - block_height)
  const initial_sync_complete = typeof data.initial_block_download_complete === 'boolean'
    ? data.initial_block_download_complete : typeof data.initialblockdownload === 'boolean'
      ? !data.initialblockdownload : null
  const verification_progress = typeof data.verificationprogress === 'number' && Number.isFinite(data.verificationprogress) &&
    data.verificationprogress >= 0 && data.verificationprogress <= 1 ? data.verificationprogress : null
  const status = (valid: boolean | null): NodeCheckStatus => valid === true ? 'pass' : valid === false ? 'fail' : 'unknown'
  const checks: NodeReadiness['checks'] = [
    {code:'NETWORK_MATCH', status:status(network === null ? null : network === expected_network)},
    {code:'CHAIN_HEIGHT',status:status(block_height === null || header_height === null ? null : header_height >= block_height)},
    {code:'HEADER_LAG',status:status(header_lag === null ? null : header_lag <= maxHeaderLag)},
    {code:'INITIAL_SYNC',status:status(initial_sync_complete)},
    {code:'VERIFICATION_PROGRESS',status:status(verification_progress === null ? null : verification_progress >= threshold)},
  ]
  return {
    schema_version:1,network,expected_network,height:block_height,headers:header_height,header_lag,
    initial_sync_complete,verification_progress,ready:checks.every(check=>check.status==='pass'),checks,
    limitation:LIMITATION,
  }
}
