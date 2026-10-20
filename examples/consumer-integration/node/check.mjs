#!/usr/bin/env node
/** Third-party Zcash application example. Non-secret declarations only. */
import { readFile } from 'node:fs/promises'
import { auditRefundPrivacyJson, compareRefundPrivacyJson, refundSarifReport } from '@zerynex/sdk'

const [baselinePath, candidatePath, format = 'json'] = process.argv.slice(2)
if (!baselinePath || !candidatePath || !['json', 'sarif'].includes(format)) {
  process.stderr.write('Usage: node check.mjs <public-safe-before.json> <public-safe-after.json> [json|sarif]\n')
  process.exitCode = 1
} else {
  try {
    const [baseline, candidate] = await Promise.all([
      readFile(baselinePath, 'utf8'), readFile(candidatePath, 'utf8'),
    ])
    const current = auditRefundPrivacyJson(candidate)
    const delta = compareRefundPrivacyJson(baseline, candidate)
    const output = format === 'sarif' ? refundSarifReport(delta) : {
      passed: delta.passed,
      candidateRuleIds: current.rule_ids,
      newRuleIds: delta.new_rule_ids,
      newRiskEvents: delta.new_risk_events,
      resolvedRiskEvents: delta.resolved_risk_events,
      limitation: delta.limitation,
    }
    process.stdout.write(JSON.stringify(output, null, 2) + '\n')
    process.exitCode = delta.passed ? 0 : 2
  } catch {
    process.stderr.write('Invalid or unreadable refund privacy metadata; no input content was printed.\n')
    process.exitCode = 1
  }
}
