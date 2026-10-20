/**
 * Strict bounded raw JSON ingestion for Zcash refund-privacy metadata.
 * Unlike JSON.parse alone, the shared parser rejects repeated object keys before
 * the data is used. This runs locally; no raw input is ever returned in errors.
 */
import {auditRefundPrivacy,compareRefundPrivacy,type RefundAuditReport,type RefundManifest,type RefundRegressionReport} from './refund-privacy.js'

import {parseStrictJson} from './strict-json.js'

/** Strict duplicate-aware JSON with shared metadata schema validation. */
export function parseRefundPrivacyJson(raw: string): RefundManifest {
  try {
    const decoded = parseStrictJson(raw, 64 * 1024)
    auditRefundPrivacy(decoded)
    return decoded as RefundManifest
  } catch {
    throw new TypeError('Invalid or ambiguous refund JSON metadata')
  }
}

/** Parse strict raw JSON, then return only redacted findings. */
export function auditRefundPrivacyJson(raw:string):RefundAuditReport {
  return auditRefundPrivacy(parseRefundPrivacyJson(raw))
}

/** Compare strict raw JSON files without revealing flow references. */
export function compareRefundPrivacyJson(previous:string,current:string):RefundRegressionReport {
  return compareRefundPrivacy(parseRefundPrivacyJson(previous),parseRefundPrivacyJson(current))
}
