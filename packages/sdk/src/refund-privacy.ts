/**
 * Offline Zcash swap/refund privacy declarations. Opaque 128-bit references
 * are developer-supplied non-secret logical labels, never hashes of addresses,
 * spending keys, viewing keys or wallet identifiers. No RPC, PIR or signing.
 */
export const REFUND_RULE_IDS = [
  'SWAP-REFUND-ADDRESS-REUSE',
  'SWAP-VIEWING-SCOPE-REUSE',
  'SWAP-PUBLIC-REFUND-UNSCOPED',
  'SWAP-REFUND-LOOKUP-DISCLOSURE',
  'SWAP-SPENDING-KEY-CUSTODY-UNVERIFIED',
] as const
export type RefundRuleId = (typeof REFUND_RULE_IDS)[number]
export type RefundLookupMode = 'private_claimed' | 'direct' | 'unknown'
export type RefundCustody = 'wallet_claimed' | 'external' | 'unknown'
export interface RefundFlow {
  flow_ref: string
  refund_address_ref: string
  viewing_scope_ref: string
  published_publicly: boolean
  lookup_mode: RefundLookupMode
  spending_key_custody: RefundCustody
}
export interface RefundManifest {schema_version: 1, flows: RefundFlow[]}
export interface RefundAuditReport {
  schema_version: 1
  passed: boolean
  flows_checked: number
  public_refund_flows: number
  finding_count: number
  rule_ids: RefundRuleId[]
  status: 'declaration_review_only'
  limitation: string
}
export interface RefundRegressionReport {
  schema_version: 1
  passed: boolean
  status: 'declaration_regression_review_only'
  baseline_flows_checked: number
  current_flows_checked: number
  baseline_risk_events: number
  current_risk_events: number
  new_risk_events: number
  resolved_risk_events: number
  new_rule_ids: RefundRuleId[]
  resolved_rule_ids: RefundRuleId[]
  limitation: string
}
const LIMITATION = 'Static, self-declared integration metadata only. No viewing-key cryptography, quantum-security, PIR, wallet behavior, chain activity, or safe recovery is verified. Do not provide addresses or keys.'
const REGRESSION_LIMITATION = 'Only application-declared logical flow identity and static risk changes. It cannot attest stable wallet identity, viewing-key isolation, private lookup, quantum resistance or transaction privacy. References are never returned.'
const ROOT_KEYS = ['schema_version','flows']
const FLOW_KEYS = ['flow_ref','refund_address_ref','viewing_scope_ref','published_publicly','lookup_mode','spending_key_custody']
const TOKEN = /^[0-9a-f]{32}$/
const isRecord = (value: unknown): value is Record<string,unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const exactKeys = (value: Record<string,unknown>, expected: readonly string[]) =>
  Object.keys(value).length === expected.length && Object.keys(value).every(key => expected.includes(key))
const validToken = (value: unknown): value is string => typeof value === 'string' && TOKEN.test(value)
const sortedRules = (rules: Set<RefundRuleId>): RefundRuleId[] => [...rules].sort()

function validate(value: unknown): RefundManifest {
  if (!isRecord(value) || !exactKeys(value,ROOT_KEYS) || value.schema_version !== 1 ||
      !Array.isArray(value.flows) || value.flows.length < 1 || value.flows.length > 100)
    throw new TypeError('Invalid refund privacy manifest schema or flow count')
  const ids = new Set<string>()
  const flows: RefundFlow[] = []
  for (const item of value.flows) {
    if (!isRecord(item) || !exactKeys(item,FLOW_KEYS) ||
        !validToken(item.flow_ref) || !validToken(item.refund_address_ref) || !validToken(item.viewing_scope_ref) ||
        typeof item.published_publicly !== 'boolean' ||
        !['private_claimed','direct','unknown'].includes(String(item.lookup_mode)) || typeof item.lookup_mode !== 'string' ||
        !['wallet_claimed','external','unknown'].includes(String(item.spending_key_custody)) || typeof item.spending_key_custody !== 'string')
      throw new TypeError('Invalid refund privacy flow; only non-secret opaque references allowed')
    if (ids.has(item.flow_ref)) throw new TypeError('Duplicate refund flow reference')
    ids.add(item.flow_ref)
    flows.push(item as unknown as RefundFlow)
  }
  return {schema_version:1,flows}
}
function evaluate(input: unknown): {report: RefundAuditReport, events: Map<string,Set<RefundRuleId>>} {
  const {flows} = validate(input)
  const addressCount = new Map<string,number>()
  const scopeCount = new Map<string,number>()
  for (const item of flows) {
    addressCount.set(item.refund_address_ref,(addressCount.get(item.refund_address_ref)??0)+1)
    scopeCount.set(item.viewing_scope_ref,(scopeCount.get(item.viewing_scope_ref)??0)+1)
  }
  const rules = new Set<RefundRuleId>()
  const events = new Map<string,Set<RefundRuleId>>()
  for (const row of flows) {
    const flagged = new Set<RefundRuleId>()
    const add = (rule: RefundRuleId) => {flagged.add(rule);rules.add(rule)}
    if ((addressCount.get(row.refund_address_ref)??0)>1) add('SWAP-REFUND-ADDRESS-REUSE')
    if ((scopeCount.get(row.viewing_scope_ref)??0)>1) add('SWAP-VIEWING-SCOPE-REUSE')
    if (row.published_publicly && (scopeCount.get(row.viewing_scope_ref)??0)>1) add('SWAP-PUBLIC-REFUND-UNSCOPED')
    if (row.lookup_mode !== 'private_claimed') add('SWAP-REFUND-LOOKUP-DISCLOSURE')
    if (row.spending_key_custody !== 'wallet_claimed') add('SWAP-SPENDING-KEY-CUSTODY-UNVERIFIED')
    events.set(row.flow_ref,flagged)
  }
  return {events,report:{
    schema_version:1,passed:rules.size===0,flows_checked:flows.length,
    public_refund_flows:flows.filter(row=>row.published_publicly).length,
    finding_count:rules.size,rule_ids:sortedRules(rules),
    status:'declaration_review_only',limitation:LIMITATION,
  }}
}
/** Pure, read-only metadata check; intentionally does not return any flow references. */
export function auditRefundPrivacy(manifest: unknown): RefundAuditReport {return evaluate(manifest).report}

/** Compare per-flow rule occurrences, including new occurrences of existing rule IDs. */
export function compareRefundPrivacy(baseline: unknown,current: unknown): RefundRegressionReport {
  const before=evaluate(baseline)
  const after=evaluate(current)
  const added=new Set<RefundRuleId>()
  const resolved=new Set<RefundRuleId>()
  let newRiskEvents=0,resolvedRiskEvents=0,baselineRiskEvents=0,currentRiskEvents=0
  for (const [flow,rules] of before.events) {
    baselineRiskEvents+=rules.size
    for(const rule of rules) if (!after.events.get(flow)?.has(rule)) {resolvedRiskEvents++;resolved.add(rule)}
  }
  for (const [flow,rules] of after.events) {
    currentRiskEvents+=rules.size
    for(const rule of rules) if (!before.events.get(flow)?.has(rule)) {newRiskEvents++;added.add(rule)}
  }
  return {
    schema_version:1,passed:newRiskEvents===0,status:'declaration_regression_review_only',
    baseline_flows_checked:before.report.flows_checked,current_flows_checked:after.report.flows_checked,
    baseline_risk_events:baselineRiskEvents,current_risk_events:currentRiskEvents,
    new_risk_events:newRiskEvents,resolved_risk_events:resolvedRiskEvents,
    new_rule_ids:sortedRules(added),resolved_rule_ids:sortedRules(resolved),
    limitation:REGRESSION_LIMITATION,
  }
}
export function refundSarifReport(report: RefundAuditReport | RefundRegressionReport) {
  if (!report || typeof report !== 'object' || !('status' in report) ||
      !['declaration_review_only','declaration_regression_review_only'].includes(report.status))
    throw new TypeError('Invalid refund privacy report')
  const isDelta=report.status==='declaration_regression_review_only'
  const selected=isDelta ? (report as RefundRegressionReport).new_rule_ids : (report as RefundAuditReport).rule_ids
  if (!Array.isArray(selected) || selected.some(rule=>!REFUND_RULE_IDS.includes(rule)))
    throw new TypeError('Invalid refund privacy rule results')
  const doc='https://zerynex.vercel.app/docs/refund-privacy-audit'
  return {
    '$schema':'https://json.schemastore.org/sarif-2.1.0.json',version:'2.1.0',
    runs:[{
      tool:{driver:{name:'Zerynex Refund Privacy Audit',informationUri:doc,semanticVersion:'0.1.0',
        rules:REFUND_RULE_IDS.map(id=>({id,shortDescription:{text:'Review declared Zcash swap refund privacy exposure'},helpUri:doc}))}},
      results:[...new Set(selected)].sort().map(ruleId=>({ruleId,level:'warning',message:{text:'Application-declared refund privacy risk requires review.'}})),
      properties:{declarationOnly:true,mode:isDelta?'regression':'full_audit',warningCount:new Set(selected).size,noInputLocations:true},
    }],
  }
}
