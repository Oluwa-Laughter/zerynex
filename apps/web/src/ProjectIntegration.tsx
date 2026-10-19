'use client'

import { useState } from 'react'
import Link from 'next/link'
import { LuArrowLeft, LuArrowUpRight, LuCheck, LuCopy, LuLockKeyhole, LuTerminal, LuWorkflow } from 'react-icons/lu'
import styles from './ProjectIntegration.module.css'

type Track = 'setup' | 'local' | 'refund' | 'cli' | 'typescript' | 'python' | 'ci' | 'mcp'
type Step = { title: string, explanation: string, code: string }
type TrackInfo = {
  label: string, tagline: string, audience: string, prerequisites: string,
  docs: string, steps: Step[], expected: string
}

const tracks: Record<Track, TrackInfo> = {
  setup: {
    label: 'Project bootstrap',
    tagline: 'Verify Zerynex in your own codebase',
    audience: 'Zcash developers adopting local PCZT privacy checks and CI',
    prerequisites: 'An existing project directory, a verified Zerynex Python wheel, Python 3.11+, and a trusted Rust CLI executable',
    docs: '/docs/project-integration',
    steps: [
      {
        title: 'Install the Python wheel locally',
        explanation: 'Download the actual wheel from a reviewed release artifact. PyPI publication is not complete; no hosted account or wallet connection is required.',
        code: 'python3 -m venv .venv\n.venv/bin/python -m pip install ./zerynex_python-0.1.0-py3-none-any.whl',
      },
      {
        title: 'Create nonspendable checks in your repository',
        explanation: 'Only two reviewed synthetic PCZTs, a policy, manifest and an optional immutable-pin CI workflow are created. Existing files are never overwritten.',
        code: 'zerynex-project init --project /absolute/path/to/my-zcash-app --ci --json',
      },
      {
        title: 'Verify the actual local Rust installation',
        explanation: 'Runs the real CLI against both bundled fixtures. One passes cleanly; the transparent example must produce the expected policy finding.',
        code: 'zerynex-project verify --project /absolute/path/to/my-zcash-app --cli /absolute/path/to/zerynex --json',
      },
    ],
    expected: 'The local CLI is installed and passes real tests on bundled synthetic files. This does not connect to private code or wallets, execute a payment, or prove wallet integration.',
  },
  local: {
    label: 'Local PCZT checks', tagline: 'Inspect your actual PCZT, explicitly',
    audience: 'Wallet, Zcash app and protocol developers with real local PCZT stages',
    prerequisites: 'An initialized Zerynex project, its installed Python wheel and Rust CLI; PCZT files inside that project that you explicitly select',
    docs: '/docs/project-integration',
    steps: [
      {title: 'Choose a PCZT in your application', explanation: 'Zerynex never searches the workstation for PCZT files. Supply an existing local path inside your project, from a trusted private environment.',
       code: 'zerynex-project check --project /path/to/my-zcash-app --pczt data/my-payment.pczt --cli /path/to/zerynex --json'},
      {title: 'Compare an earlier and a later stage', explanation: 'Run the real Rust stage-comparison engine on two explicitly selected files to detect newly introduced policy findings. This is not a transaction-equivalence proof.',
       code: 'zerynex-project compare --project /path/to/my-zcash-app --before data/before.pczt --after data/after.pczt --cli /path/to/zerynex --json'},
      {title: 'Review the local-only result', explanation: 'Exit 0 means no findings for selected rules; exit 2 means policy findings/regressions; exit 1 indicates an invalid path, input or engine failure. No private PCZT data or source paths are printed.',
       code: '# No background scan. No PCZT upload.\n# Check only files you explicitly selected.\n# Never upload real PCZT artifacts to public CI or agents.'},
    ],
    expected: 'An offline policy finding count and known rule IDs returned by the local Rust engine, with stage-regression classification when requested. No wallet operation, signing or consensus verification.',
  },
  refund: {
    label: 'Refund privacy audit', tagline: 'Model swap refund linkability risks',
    audience: 'Wallet, cross-chain, swap and privacy engineers',
    prerequisites: 'Locally installed Zerynex Python wheel and JSON manifest of non-secret opaque 128-bit references',
    docs: '/docs/refund-privacy-audit',
    steps: [
      {
        title: 'Prepare public-safe configuration metadata',
        explanation: 'Declare logical reuse of refund identifiers and viewing-key scopes. Never put real addresses, keys, transaction history or wallet identities in this manifest.',
        code: '{\n  "schema_version":1,\n  "flows":[{\n    "flow_ref":"11111111111111111111111111111111",\n    "refund_address_ref":"22222222222222222222222222222222",\n    "viewing_scope_ref":"33333333333333333333333333333333",\n    "published_publicly":true,\n    "lookup_mode":"private_claimed",\n    "spending_key_custody":"wallet_claimed"\n  }]\n}',
      },
      {
        title: 'Run the offline metadata auditor',
        explanation: 'Checks declarations about address reuse, scope reuse, sensitive refund queries and custody assumptions. No RPC, wallet or cryptographic verification is performed.',
        code: 'zerynex-refund-audit --manifest /path/to/nonsecret-refund-metadata.json --json',
      },
      {
        title: 'Compare a baseline and candidate revision',
        explanation: 'Detect newly introduced privacy exposure on specific declared swap flows—even if the warning already existed for another flow. Only fixed rule IDs and counts are returned.',
        code: 'zerynex-refund-audit --baseline tests/refund/before.json --manifest tests/refund/after.json --json',
      },
      {
        title: 'Export a sanitized SARIF summary',
        explanation: 'Export fixed rule identifiers for code-quality pipelines. Deliberately no source locations or swap identifiers are present.',
        code: 'zerynex-refund-audit --baseline tests/refund/before.json --manifest tests/refund/after.json --sarif',
      },
      {
        title: 'Independently verify wallet isolation',
        explanation: 'Review whether your wallet really creates separate viewing scopes and provides private refund lookups. A clean metadata report cannot prove either.',
        code: '# Exit 0: no declared issues\n# Exit 2: declared privacy risks\n# Exit 1: invalid metadata input',
      },
    ],
    expected: 'An offline count of application-declared privacy concerns and fixed rule IDs. This does not prove post-quantum security, correct viewing keys or private information retrieval.',
  },
  cli: {
    label: 'Rust CLI', tagline: 'Analyze a PCZT stored on your machine',
    audience: 'Wallet engineers, Rust developers and protocol teams',
    prerequisites: 'Rust toolchain; an explicitly selected local PCZT file',
    docs: '/docs/cli-reference',
    steps: [
      {
        title: 'Install the engine',
        explanation: 'Build the supported CLI from the public source repository. No Zerynex account or wallet connection is required.',
        code: 'cargo install --git https://github.com/Oluwa-Laughter/zerynex --locked --bin zerynex\nzerynex --capabilities',
      },
      {
        title: 'Create a project policy',
        explanation: 'Save this JSON in your own project as zerynex-policy.json. Denying transparent components is a project policy, not a Zcash protocol requirement.',
        code: '{\n  "profile": "external_signer",\n  "deny_transparent": true,\n  "deny_sapling": false\n}',
      },
      {
        title: 'Run against a file you choose',
        explanation: 'Your terminal reads only the file path you supply. Do not paste confidential PCZTs into a website, issue, or agent conversation.',
        code: 'zerynex /absolute/path/to/your-local.pczt \\\n  --policy-file ./zerynex-policy.json --json',
      },
    ],
    expected: 'Exit 0 = no findings in implemented rules; 2 = findings; 1 = invalid input or runtime failure. A clean report is not proof of anonymity or valid signatures.',
  },
  typescript: {
    label: 'TypeScript / WASM', tagline: 'Embed the actual Rust engine in a dApp',
    audience: 'React, Next.js, browser wallet and TypeScript developers',
    prerequisites: 'A trusted, built @zerynex/sdk tarball with its WASM asset',
    docs: '/docs/typescript-api',
    steps: [
      {
        title: 'Install an actual package artifact',
        explanation: 'The SDK is independently tested as an npm tarball, but it has not been published to the public npm registry. Get the artifact from Releases or build packages/sdk from source.',
        code: 'npm install /absolute/path/to/downloaded/zerynex-sdk.tgz\n# Use your actual downloaded artifact filename.',
      },
      {
        title: 'Connect your own file input',
        explanation: 'Use a developer-selected browser File. The PCZT stays inside the browser; no hosted analysis endpoint or automatic filesystem access is involved.',
        code: "import { createBrowserZerynexClient } from '@zerynex/sdk/browser'\n\nconst client = createBrowserZerynexClient()\nawait client.ready()\nconst file = document.querySelector<HTMLInputElement>('#pczt-input')?.files?.[0]\nif (!file) throw new Error('Select a local PCZT first')\nconst report = await client.analyzeBlob(file, {\n  profile: 'external_signer', deny_transparent: true,\n})\nconsole.log(report.findings.map(({rule,field}) => ({rule,field})))",
      },
      {
        title: 'Handle policy findings in your app',
        explanation: 'Render the returned rule IDs and field paths, or block a handoff in your own application. Your wallet handles approval and signing independently.',
        code: "if (report.findings.length > 0) {\n  // Show policy findings before your application's wallet handoff.\n  throw new Error('Review PCZT disclosure policy findings')\n}",
      },
    ],
    expected: 'A local WASM report with structural policy findings. Your app must bundle/serve the trusted WASM asset and handle user approval itself; no wallet connects automatically.',
  },
  python: {
    label: 'Python SDK', tagline: 'Automate Zcash policy checks locally',
    audience: 'Python test suites, tooling backends and automation developers',
    prerequisites: 'Python 3.11+; the Zerynex source package and trusted Rust CLI',
    docs: '/docs/python-api',
    steps: [
      {
        title: 'Install from the source checkout',
        explanation: 'PyPI publication is not complete. This checkout supplies the Python package and the canonical Rust engine.',
        code: 'git clone https://github.com/Oluwa-Laughter/zerynex.git\ncd zerynex\ncargo build --locked --release --bin zerynex\npython3 -m venv .venv\n.venv/bin/python -m pip install ./packages/python',
      },
      {
        title: 'Use the SDK in your test or service',
        explanation: 'Point the Python client to the locally compiled executable and a local fixture or PCZT. The SDK delegates parsing to Rust.',
        code: "from zerynex_py import ZerynexClient, Policy\n\nclient = ZerynexClient(cli='/absolute/path/to/zerynex/target/release/zerynex')\nreport = client.analyze_file(\n    '/absolute/path/to/your-local.pczt',\n    Policy(deny_transparent=True),\n)\nprint(report.agent_summary())",
      },
      {
        title: 'Keep private material out of remote jobs',
        explanation: 'Use nonspendable synthetic files in CI; reserve real intermediate PCZTs for your own trusted local execution.',
        code: '# Run locally from your trusted Python environment:\n.venv/bin/python -m unittest discover -s tests',
      },
    ],
    expected: 'The Python package produces bounded structured Rust-policy results without a hosted service. The example test directory is yours to create.',
  },
  ci: {
    label: 'GitHub Actions', tagline: 'Run reproducible checks on every PR',
    audience: 'Open-source maintainers, protocol teams and reviewers',
    prerequisites: 'A repository containing a nonspendable synthetic PCZT fixture',
    docs: '/docs/github-action',
    steps: [
      {
        title: 'Add a synthetic fixture and policy',
        explanation: 'Only commit generated nonspendable PCZTs. Never commit real user PCZTs, keys, wallet databases or private transaction records.',
        code: 'tests/fixtures/synthetic.pczt\npolicies/shielded-only.json',
      },
      {
        title: 'Create .github/workflows/zerynex.yml',
        explanation: 'This installs the Rust engine in your GitHub runner. The @main reference is for development; pin a reviewed immutable commit for production.',
        code: "name: Zcash privacy regression\non: [push, pull_request]\npermissions:\n  contents: read\njobs:\n  pczt-policy:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: Oluwa-Laughter/zerynex@main\n        id: privacy\n        with:\n          pczt-path: tests/fixtures/synthetic.pczt\n          policy-path: policies/shielded-only.json\n          fail-on-findings: 'true'",
      },
      {
        title: 'Understand the result',
        explanation: 'The action fails for malformed inputs and, by default, for policy findings. It does not prove privacy or that a transaction is valid.',
        code: "# Expected GitHub Action outputs:\n# steps.privacy.outputs.passed\n# steps.privacy.outputs.finding-count",
      },
    ],
    expected: 'Reviewable policy regression checks on synthetic fixtures within your own GitHub repository; never an automatic connection to your developer laptop.',
  },
  mcp: {
    label: 'MCP / agents', tagline: 'Connect approved local development fixtures',
    audience: 'Developers using a compatible local MCP host',
    prerequisites: 'Local Rust CLI, Python 3.11+, MCP host and approved synthetic fixture directory',
    docs: '/docs/agents',
    steps: [
      {
        title: 'Build the optional local server',
        explanation: 'MCP runs in your own machine as a stdio process. It does not grant agents full filesystem access or connect wallets.',
        code: "git clone https://github.com/Oluwa-Laughter/zerynex.git\ncd zerynex\ncargo build --locked --release --bin zerynex\npython3 -m venv .venv\n.venv/bin/python -m pip install './packages/python[mcp]'",
      },
      {
        title: 'Restrict file access to synthetic fixtures',
        explanation: 'Replace the paths with absolute paths on your own device, and configure your MCP host to launch the installed zerynex-mcp executable.',
        code: 'ZERYNEX_CLI=/absolute/path/to/zerynex/target/release/zerynex\nZERYNEX_AGENT_ALLOWED_ROOT=/absolute/path/to/zerynex/apps/web/public/examples\n# MCP command: /absolute/path/to/zerynex/.venv/bin/zerynex-mcp',
      },
      {
        title: 'Verify the host connection',
        explanation: 'The doctor launches a real stdio server, discovers approved tools and validates synthetic regression expectations without wallet keys.',
        code: '/absolute/path/to/zerynex/.venv/bin/zerynex-mcp-doctor \\\n  --server /absolute/path/to/zerynex/.venv/bin/zerynex-mcp \\\n  --cli /absolute/path/to/zerynex/target/release/zerynex \\\n  --fixtures /absolute/path/to/zerynex/apps/web/public/examples',
      },
    ],
    expected: 'Only approved local synthetic-fixture and metadata tools become available to the configured MCP host. Agents cannot inspect arbitrary private PCZTs or authorize payments.',
  },
}

const keys: Track[] = ['setup','local','refund','cli','typescript','python','ci','mcp']

export default function ProjectIntegration() {
  const [selected,setSelected] = useState<Track>('setup')
  const [copied,setCopied] = useState<number | null>(null)
  const [copyError,setCopyError] = useState(false)
  const active = tracks[selected]

  async function copyStep(code: string,index: number) {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(index)
      setCopyError(false)
    } catch {
      setCopied(null)
      setCopyError(true)
    }
  }
  function choose(key: Track) {
    setSelected(key)
    setCopied(null)
    setCopyError(false)
  }

  return <main className={styles.page}>
    <div className={styles.top}>
      <Link href="/"><LuArrowLeft size={16}/> Overview</Link>
      <span>DEVELOPER WORKSPACE / INTEGRATION GUIDE</span>
      <Link href="/docs/project-integration">Complete documentation <LuArrowUpRight size={16}/></Link>
    </div>
    <header className={styles.hero}>
      <span className={styles.eyebrow}><LuWorkflow size={17}/> CONNECT YOUR OWN TOOLCHAIN</span>
      <h1>From a demo to <em>your project.</em></h1>
      <p>Zerynex does not automatically connect to a developer&apos;s computer or Zcash wallet. Choose an interface, install it into your trusted environment, then run checks against files your application explicitly supplies.</p>
      <div className={styles.shortcuts}>
        <Link href="/#synthetic-demo">01 / Try bundled demo <LuArrowUpRight size={15}/></Link>
        <Link href="/tools">02 / Analyze a local PCZT <LuArrowUpRight size={15}/></Link>
        <span>03 / Integrate your project — below</span>
      </div>
    </header>
    <div className={styles.layout}>
      <section className={styles.sidebar} aria-label="Select developer integration">
        <span className={styles.label}>01 / CHOOSE YOUR ENVIRONMENT</span>
        <div className={styles.picker} role="group" aria-label="Integration methods">
          {keys.map((key,index)=><button key={key} type="button" aria-pressed={key===selected}
            onClick={()=>choose(key)}>
            <span>{String(index+1).padStart(2,'0')}</span>
            <strong>{tracks[key].label}</strong>
            <LuArrowUpRight size={16}/>
          </button>)}
        </div>
        <div className={styles.trust}>
          <LuLockKeyhole size={19}/>
          <p><strong>Local-first boundaries.</strong> No account, wallet connection, background scanner or remote PCZT upload is created by this onboarding page. Private data remains under your control.</p>
        </div>
      </section>
      <section className={styles.content} aria-live="polite">
        <div className={styles.contentHead}>
          <div><span className={styles.label}>02 / INSTALL · CONFIGURE · VERIFY</span><h2>{active.tagline}</h2></div>
          <span className={styles.mode}><LuTerminal size={16}/> {active.label.toUpperCase()}</span>
        </div>
        <p className={styles.audience}>{active.audience}</p>
        <div className={styles.requirements}><strong>BEFORE YOU START</strong><p>{active.prerequisites}</p></div>
        <div className={styles.steps}>
          {active.steps.map((step,index)=><article className={styles.step} key={selected+'-'+index}>
            <div className={styles.stepTitle}><span>{String(index+1).padStart(2,'0')}</span><h3>{step.title}</h3></div>
            <p>{step.explanation}</p>
            <div className={styles.codeHead}><span>{index===1&&selected==='cli'?'JSON':selected==='ci'&&index===1?'YAML':selected==='typescript'&&index>0?'TYPESCRIPT':selected==='python'&&index===1?'PYTHON':'COPYABLE EXAMPLE'}</span>
              <button type="button" onClick={()=>void copyStep(step.code,index)}
                aria-label={'Copy '+step.title+' example'}><LuCopy size={15}/>{copied===index?'Copied':'Copy'}</button>
            </div>
            <pre><code>{step.code}</code></pre>
          </article>)}
        </div>
        {copyError&&<p className={styles.copyError} role="alert">Clipboard access was denied. Select the example text and copy it manually.</p>}
        <div className={styles.expected}>
          <LuCheck size={19}/>
          <div><strong>What success looks like</strong><p>{active.expected}</p></div>
        </div>
        <div className={styles.links}>
          <Link href={active.docs}>Read {active.label} reference <LuArrowUpRight size={17}/></Link>
          <Link href="/docs/privacy-model">Privacy & security boundaries <LuArrowUpRight size={17}/></Link>
        </div>
      </section>
    </div>
    <footer className={styles.footer}>BUILT FOR ZCASH DEVELOPERS / LOCAL-FIRST, EXPLICIT ACCESS, SYNTHETIC PUBLIC CI.</footer>
  </main>
}
