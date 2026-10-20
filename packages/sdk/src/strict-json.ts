/**
 * Shared local JSON boundary for user-imported privacy policies and refund
 * metadata. JSON.parse silently accepts duplicate members (last value wins),
 * which could disable a protection the author intended to enable.
 *
 * Reject repeated decoded keys at every depth, including Unicode-escaped
 * aliases; never incorporate source text into errors.
 */
const SPACE = /[\x20\t\r\n]/
const ESCAPES = /^["\\/bfnrt]$/
const NUMBER_OR_LITERAL = /^(?:true|false|null|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)/

export function parseStrictJson(raw: string, maxBytes: number, maxDepth = 12): unknown {
  const fail = (): never => { throw new TypeError('Invalid or ambiguous JSON document') }
  if (typeof raw !== 'string' || !raw || new TextEncoder().encode(raw).byteLength > maxBytes) fail()
  let i = 0
  function whitespace() { while (i < raw.length && SPACE.test(raw[i]!)) i++ }
  function readString(): string {
    if (raw[i] !== '"') return fail()
    const start = i++
    while (i < raw.length) {
      const ch = raw[i++]!
      if (ch === '"') {
        try { return JSON.parse(raw.slice(start, i)) as string } catch { return fail() }
      }
      if (ch === '\\') {
        if (i >= raw.length) return fail()
        const escaped = raw[i++]!
        if (escaped === 'u') {
          for (let j = 0; j < 4; j++) {
            if (i >= raw.length || !/[0-9a-fA-F]/.test(raw[i++]!)) return fail()
          }
        } else if (!ESCAPES.test(escaped)) return fail()
      } else if (ch.charCodeAt(0) < 0x20) return fail()
    }
    return fail()
  }
  function readValue(depth: number): void {
    if (depth > maxDepth) return fail()
    whitespace()
    if (raw[i] === '{') {
      i++; whitespace()
      const seen = new Set<string>()
      if (raw[i] === '}') { i++; return }
      for (;;) {
        whitespace()
        const key = readString()
        if (seen.has(key)) return fail()
        seen.add(key)
        whitespace()
        if (raw[i++] !== ':') return fail()
        readValue(depth + 1)
        whitespace()
        const end = raw[i++]
        if (end === '}') return
        if (end !== ',') return fail()
      }
    }
    if (raw[i] === '[') {
      i++; whitespace()
      if (raw[i] === ']') { i++; return }
      for (;;) {
        readValue(depth + 1)
        whitespace()
        const end = raw[i++]
        if (end === ']') return
        if (end !== ',') return fail()
      }
    }
    if (raw[i] === '"') { readString(); return }
    const match = NUMBER_OR_LITERAL.exec(raw.slice(i))
    if (!match) return fail()
    i += match[0].length
  }
  try {
    whitespace(); readValue(0); whitespace()
    if (i !== raw.length) return fail()
    return JSON.parse(raw) as unknown
  } catch {
    return fail()
  }
}
