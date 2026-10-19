'use client'

import { useState } from 'react'
import { LuCheck, LuCopy, LuTriangleAlert } from 'react-icons/lu'

/** Copy only the static, reviewed Markdown source, never data from a wallet. */
export default function DocsCodeBlock({ code, language }: { code: string, language?: string }) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')
  const name = language?.replace(/[^a-zA-Z0-9_+#.-]/g, '').slice(0, 25) || 'text'

  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopyState('copied')
    } catch {
      setCopyState('error')
    }
  }

  return <figure className="docs-code-block">
    <figcaption className="docs-code-head">
      <span className="docs-code-language">{name === 'text' ? 'EXAMPLE' : name.toUpperCase()}</span>
      <button type="button" className="docs-code-copy" onClick={() => void copy()}
        aria-label={'Copy ' + name + ' code to clipboard'}>
        {copyState === 'copied' ? <LuCheck size={16} aria-hidden="true"/> :
          copyState === 'error' ? <LuTriangleAlert size={16} aria-hidden="true"/> :
          <LuCopy size={16} aria-hidden="true"/>}
        {copyState === 'copied' ? 'Copied' : copyState === 'error' ? 'Copy failed' : 'Copy'}
      </button>
    </figcaption>
    <pre><code>{code}</code></pre>
    <span className="docs-code-feedback" role="status" aria-live="polite">
      {copyState === 'copied' ? 'Code copied to clipboard.' :
        copyState === 'error' ? 'Clipboard access unavailable. Select the code and copy manually.' : ''}
    </span>
  </figure>
}
