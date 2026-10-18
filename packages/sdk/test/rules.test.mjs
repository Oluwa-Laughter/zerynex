import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { RULE_CATALOG, getRule } from '../dist/index.js'
import { RULE_CATALOG as SOURCE_CATALOG, getRule as sourceGetRule } from '../src/rule-catalog.js'

const source = JSON.parse(readFileSync(new URL('../../../rules/catalog.json', import.meta.url), 'utf8'))

test('published TypeScript rule registry exactly matches canonical Rust metadata', () => {
  assert.deepEqual(RULE_CATALOG, source)
  assert.deepEqual(SOURCE_CATALOG, source)
  assert.equal(sourceGetRule('PCZT-STRUCTURE-DRIFT')?.severity, 'error')
  assert.equal(RULE_CATALOG.schema_version, 1)
  assert.equal(RULE_CATALOG.rule_set_version, '1.0.0')
  assert.equal(RULE_CATALOG.rules.length, 8)
  for (const rule of RULE_CATALOG.rules) assert.equal(getRule(rule.id)?.severity, rule.severity)
  assert.equal(getRule('made-up-rule'), undefined)
})
