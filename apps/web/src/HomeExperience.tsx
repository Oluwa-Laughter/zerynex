'use client'

import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import {
  LuArrowRight, LuArrowLeft, LuArrowUpRight,
  LuChevronDown, LuExternalLink, LuGitBranch, LuLockKeyhole,
  LuScanLine, LuLayers3, LuWorkflow, LuTerminal,
  LuShieldCheck, LuCode, LuBookOpen,
} from 'react-icons/lu'

const repo = 'https://github.com/Oluwa-Laughter/zerynex'
type View = 'home' | 'tools' | 'ecosystem'

const capabilities = [
  {
    overline: '01 / BROWSER TOOLING',
    title: 'Developer Tools',
    description: 'Inspect a local PCZT, configure your disclosure policy, and export findings—using the real Rust engine compiled to WebAssembly.',
    technical: 'PCZT · RUST / WASM',
    icon: LuScanLine,
    action: 'Open PCZT Inspector',
    view: 'tools' as View,
  },
  {
    overline: '02 / POLICY ENGINE',
    title: 'Policy as code',
    description: 'Automate repeatable privacy regression checks with transparent, Sapling, Orchard and Ironwood field policies.',
    technical: 'RUST CLI · JSON',
    icon: LuGitBranch,
    action: 'Explore the policies',
    href: repo + '/tree/main/policies',
  },
  {
    overline: '03 / MULTI-LANGUAGE',
    title: 'Developer SDKs',
    description: 'Use the same core from TypeScript, Python and Rust without creating another service that receives transaction data.',
    technical: 'TYPESCRIPT · PYTHON · RUST',
    icon: LuCode,
    action: 'Browse onboarding',
    view: 'ecosystem' as View,
  },
  {
    overline: '04 / AGENTIC WORKFLOWS',
    title: 'Local agent tools',
    description: 'Give AI assistants narrow MCP tools for synthetic fixtures and sanitized findings—not unrestricted access to wallet secrets.',
    technical: 'MCP · AGENT SKILL',
    icon: LuWorkflow,
    action: 'Read the agent guide',
    href: repo + '/blob/main/docs/agents.md',
  },
  {
    overline: '05 / NODE OPERATIONS',
    title: 'Z3 diagnostics',
    description: 'Check Zebra liveness and readiness on loopback without accessing Zallet keys or treating a health signal as a consensus proof.',
    technical: 'ZEBRA · Z3',
    icon: LuLayers3,
    action: 'View node workflow',
    view: 'ecosystem' as View,
  },
]

const faq = [
  {
    question: 'Does Zerynex upload my transaction data?',
    answer: 'No hosted PCZT analysis service is required. The PCZT Inspector processes files locally through the Rust WebAssembly engine, and the CLI runs on your machine. You should still use a trusted device and browser.',
  },
  {
    question: 'Does a passing report prove a transaction is private?',
    answer: 'No. Zerynex checks specific disclosure rules in intermediate PCZTs. It does not prove anonymity, validate consensus, authorize signing, or conduct a complete cryptographic audit.',
  },
  {
    question: 'Can I use Zerynex with Python, TypeScript, or Rust?',
    answer: 'Yes. The Rust engine and CLI are the foundation. The TypeScript SDK runs the compiled Rust engine through WebAssembly, while the Python SDK currently uses the trusted local Rust CLI.',
  },
  {
    question: 'Can an AI agent review a Zcash workflow?',
    answer: 'Zerynex provides a portable Agent Skill and an opt-in local MCP server for approved synthetic fixtures. The tools return limited, sanitized policy findings instead of wallet secrets or raw PCZT bytes.',
  },
]

function WordTitle({ text, italic = false }: { text: string; italic?: boolean }) {
  return <span className={'cinema-title-line' + (italic ? ' cinema-title-serif' : '')} aria-hidden="true">
    {text.split(' ').map((word, i) => <span className="cinema-word-mask" key={i}>
      <span className="cinema-word">{word}</span>
    </span>)}
  </span>
}

function Aurora({ small = false }: { small?: boolean }) {
  return <div aria-hidden="true" className={'aurora-scene' + (small ? ' aurora-small' : '')}>
    <div className="aurora-layer aurora-layer-a"/>
    <div className="aurora-layer aurora-layer-b"/>
    <div className="aurora-layer aurora-layer-c"/>
    <div className="aurora-horizon"/>
  </div>
}

export default function HomeExperience({ navigate }: { navigate: (page: View) => void }) {
  const ref = useRef<HTMLElement>(null)
  const rail = useRef<HTMLDivElement>(null)
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(false)

  function updateRail() {
    const el = rail.current
    if (!el) return
    setAtStart(el.scrollLeft <= 2)
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2)
  }

  useEffect(() => {
    const node = rail.current
    if (!node) return
    updateRail()
    const resize = new ResizeObserver(updateRail)
    resize.observe(node)
    node.addEventListener('scroll', updateRail, { passive: true })
    return () => {
      resize.disconnect()
      node.removeEventListener('scroll', updateRail)
    }
  }, [])

  useEffect(() => {
    if (!ref.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    gsap.registerPlugin(ScrollTrigger)
    const context = gsap.context(() => {
      const intro = gsap.timeline({ defaults: { ease: 'power3.out' } })
      intro.from('.cinema-eyebrow', { y: 16, opacity: 0, filter: 'blur(8px)', duration: .55 })
        .from('.cinema-word', {
          yPercent: 90, opacity: 0, filter: 'blur(10px)', stagger: .055,
          duration: .95, ease: 'power4.out',
        }, '-=.25')
        .from('.cinema-subtitle', { y: 24, opacity: 0, filter: 'blur(10px)', duration: .72 }, '-=.32')
        .from('.cinema-actions', { y: 18, opacity: 0, duration: .65 }, '-=.42')
        .from('.cinema-hero-note', { y: 16, opacity: 0, duration: .65 }, '-=.4')

      gsap.utils.toArray<HTMLElement>('.cinema-reveal').forEach(element => {
        gsap.from(element, {
          y: 26, opacity: 0, filter: 'blur(8px)', duration: .9,
          scrollTrigger: { trigger: element, start: 'top 91%', once: true },
        })
      })
      gsap.utils.toArray<HTMLElement>('.cinema-stagger').forEach(element => {
        gsap.from(Array.from(element.children), {
          y: 25, opacity: 0, filter: 'blur(7px)', stagger: .09, duration: .8,
          scrollTrigger: { trigger: element, start: 'top 89%', once: true },
        })
      })
      gsap.to('.cinema-statement-text', {
        opacity: 1, filter: 'blur(0px)', ease: 'none',
        scrollTrigger: { trigger: '.cinema-statement', start: 'top 75%', end: 'center 45%', scrub: true },
      })
    }, ref)
    return () => context.revert()
  }, [])

  function slide(direction: -1 | 1) {
    const el = rail.current
    if (!el) return
    const firstCard = el.querySelector<HTMLElement>('.cinema-work-card')
    const distance = (firstCard?.getBoundingClientRect().width ?? 370) + 16
    el.scrollBy({ left: distance * direction, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }

  return <main className="cinema-home" ref={ref}>
    <section className="cinema-hero" aria-label="Zerynex privacy infrastructure">
      <div className="cinema-hero-content">
        <span className="cinema-eyebrow"><span className="cinema-status-dot"/> BUILT FOR ZCASH CORE & TOOLING</span>
        <h1 className="cinema-heading" aria-label="Privacy is a property. Not a promise.">
          <WordTitle text="Privacy is a"/>
          <WordTitle text="property. Not a promise." italic/>
        </h1>
        <p className="cinema-subtitle">Privacy engineering should be testable. Inspect Zcash transaction handoffs, enforce explicit policies, and build on one local-first Rust foundation.</p>
        <div className="cinema-actions">
          <button type="button" className="cinema-button cinema-button-primary" onClick={() => navigate('tools')}>Open Developer Tools <LuArrowUpRight size={17}/></button>
          <button type="button" className="cinema-button cinema-button-secondary" onClick={() => navigate('ecosystem')}>Explore developer tools <LuArrowRight size={17}/></button>
        </div>
        <p className="cinema-hero-note"><LuLockKeyhole size={14}/> LOCAL ANALYSIS · NO HOSTED PCZT PROCESSING</p>
      </div>
      <Aurora/>
      <div className="cinema-scroll-cue"><span>SCROLL TO EXPLORE</span><LuChevronDown size={15}/></div>
    </section>

    <section className="cinema-marquee-zone" aria-label="Technology ecosystem">
      <span className="cinema-marquee-label">AN OPEN TOOLCHAIN</span>
      <div className="cinema-marquee">
        <div className="cinema-marquee-track">
          {Array.from({ length: 2 }).map((_, i) =>
            <span className="cinema-marquee-group" key={i} aria-hidden={i === 1}>
              <span>RUST</span><LuShieldCheck/><span>ZCASH</span><LuShieldCheck/>
              <span>TYPESCRIPT</span><LuShieldCheck/><span>PYTHON</span><LuShieldCheck/>
              <span>PCZT</span><LuShieldCheck/><span>MCP</span><LuShieldCheck/>
              <span>WEBASSEMBLY</span><LuShieldCheck/><span>Z3</span><LuShieldCheck/>
            </span>
          )}
        </div>
      </div>
    </section>

    <section className="cinema-section cinema-product-section" id="capabilities">
      <div className="cinema-center-heading cinema-reveal">
        <span className="cinema-pill">THE TOOLCHAIN</span>
        <h2>Built for the <em>unseen.</em></h2>
        <p>Privacy rules you can run, test, and integrate. Explore the parts of Zerynex that work today.</p>
      </div>
      <div className="cinema-work-rail cinema-stagger" ref={rail} aria-label="Developer tools" tabIndex={0}>
        {capabilities.map((item, i) => <article className="cinema-work-card" key={item.title}>
          <div className={'cinema-work-visual cinema-visual-' + (i % 3)}>
            <div className="cinema-work-pattern" aria-hidden="true"/>
            <item.icon size={66} strokeWidth={.8}/>
            <span>{item.technical}</span>
          </div>
          <div className="cinema-work-info">
            <span className="cinema-work-overline">{item.overline}</span>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
            {item.view
              ? <button onClick={() => navigate(item.view)}>{item.action} <LuArrowUpRight size={16}/></button>
              : <a href={item.href} target="_blank" rel="noopener noreferrer">{item.action} <LuExternalLink size={16}/></a>}
          </div>
        </article>)}
      </div>
      <div className="cinema-rail-controls">
        <span>EXPLORE TOOLS / {capabilities.length.toString().padStart(2, '0')}</span>
        <div>
          <button aria-label="Previous tool" disabled={atStart} onClick={() => slide(-1)}><LuArrowLeft size={18}/></button>
          <button aria-label="Next tool" disabled={atEnd} onClick={() => slide(1)}><LuArrowRight size={18}/></button>
        </div>
      </div>
    </section>

    <section className="cinema-statement" id="principles">
      <span className="cinema-pill cinema-reveal">OUR PRINCIPLE</span>
      <h2 className="cinema-statement-text">A shielded transaction can still have an exposed journey. <em>Test the boundary before information changes hands.</em></h2>
      <button className="cinema-button cinema-button-primary cinema-reveal" onClick={() => navigate('tools')}>Run a PCZT check <LuArrowUpRight size={16}/></button>
    </section>

    <section className="cinema-section cinema-method" id="protocol">
      <div className="cinema-center-heading cinema-reveal">
        <span className="cinema-pill">HOW IT WORKS</span>
        <h2>Three steps to <em>clarity.</em></h2>
        <p>Real PCZT parsing, explicit field policies, and useful findings. No simulated cryptographic guarantees.</p>
      </div>
      <div className="cinema-method-grid cinema-stagger">
        {[
          { number: '01', icon: LuLayers3, title: 'Choose a boundary', content: 'Select a signing or restricted-handoff policy. Apply shielded-only constraints where required.' },
          { number: '02', icon: LuScanLine, title: 'Inspect locally', content: 'Run the Rust analyzer in your browser, CLI, Python workflow, or trusted development environment.' },
          { number: '03', icon: LuTerminal, title: 'Act on findings', content: 'Get rule identifiers and field paths without copying the underlying transaction data into a hosted service.' },
        ].map(step => <article className="cinema-method-step" key={step.number}>
          <span className="cinema-step-number">{step.number}</span>
          <div className="cinema-method-icon"><step.icon size={29} strokeWidth={1.4}/></div>
          <h3>{step.title}</h3>
          <p>{step.content}</p>
        </article>)}
      </div>
    </section>

    <section className="cinema-section cinema-faq" id="faq">
      <div className="cinema-center-heading cinema-reveal">
        <span className="cinema-pill">FREQUENT QUESTIONS</span>
        <h2>Privacy, in <em>plain English.</em></h2>
        <p>Clear guarantees, clear limitations, and no surprises about the data your tools handle.</p>
      </div>
      <div className="cinema-faq-list">
        {faq.map((item, i) => <div className={'cinema-faq-item' + (openFaq === i ? ' cinema-faq-open' : '')} key={item.question}>
          <h3><button aria-expanded={openFaq === i} aria-controls={'cinema-faq-answer-' + i} onClick={() => setOpenFaq(openFaq === i ? null : i)}>
            {item.question}<span className="cinema-faq-icon">{openFaq === i ? '−' : '+'}</span>
          </button></h3>
          <div id={'cinema-faq-answer-' + i} className="cinema-faq-answer" hidden={openFaq !== i}><p>{item.answer}</p></div>
        </div>)}
      </div>
    </section>

    <section className="cinema-last-section">
      <div className="cinema-last-card cinema-reveal">
        <span className="cinema-pill">BUILT TO BE BUILT ON</span>
        <h2>Make privacy a <em>testable property.</em></h2>
        <p>Start with a local PCZT fixture, choose a disclosure policy, and see what Zerynex checks—not what it pretends to prove.</p>
        <div className="cinema-actions">
          <button onClick={() => navigate('tools')} className="cinema-button cinema-button-primary">Run PCZT Inspector <LuArrowUpRight size={16}/></button>
          <a href={repo} target="_blank" rel="noopener noreferrer" className="cinema-button cinema-button-secondary">Explore GitHub <LuExternalLink size={16}/></a>
        </div>
        <Aurora small/>
      </div>
    </section>
    <footer className="cinema-footer">
      <div><strong>ZERYNEX<span>.</span></strong><p>Privacy checks, not empty promises.</p></div>
      <nav aria-label="Footer">
        <button onClick={() => navigate('ecosystem')}>Developer ecosystem</button>
        <button onClick={() => navigate('tools')}>Developer Tools</button>
        <a href={repo + '/blob/main/README.md'} target="_blank" rel="noopener noreferrer">Documentation <LuBookOpen size={13}/></a>
        <a href={repo} target="_blank" rel="noopener noreferrer">Source code <LuExternalLink size={13}/></a>
      </nav>
      <div className="cinema-footer-bottom"><span>ZERYNEX / ZCASH CORE & TOOLING</span><span>OPEN SOURCE · RESEARCH SOFTWARE · {new Date().getFullYear()}</span></div>
    </footer>
  </main>
}
