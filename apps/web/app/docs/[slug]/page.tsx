import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { LuArrowLeft, LuArrowUpRight } from 'react-icons/lu'
import DocsLayout, { Status } from '../../../src/docs/DocsLayout'
import { docsHref, getGuide, guides } from '../../../src/docs/catalog'

export function generateStaticParams() {
  return guides.map(guide => ({ slug: guide.slug }))
}
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const guide = getGuide(slug)
  return guide ? { title: guide.title, description: guide.summary } : { title: 'Guide not found' }
}

export default async function DocumentationArticle({params}: {params: Promise<{ slug: string }>}) {
  const { slug } = await params
  const guide = getGuide(slug)
  if (!guide) notFound()
  const content = await readFile(path.join(process.cwd(), 'content/docs', slug + '.md'), 'utf8')
  const position = guides.findIndex(entry => entry.slug === slug)
  const previous = position > 0 ? guides[position - 1] : undefined
  const next = position < guides.length - 1 ? guides[position + 1] : undefined
  return <DocsLayout selected={slug}>
    <article className="docs-article">
      <div className="docs-article-heading">
        <span className="docs-kicker">{guide.group.toUpperCase()} / {guide.audience.toUpperCase()}</span>
        <h1>{guide.title}</h1>
        <p>{guide.summary}</p>
        <div className="docs-article-labels"><Status status={guide.status}/>

        </div>
      </div>
      {(slug==='pczt-stage-regression'||slug==='handoff-harness')&&
        <div className="docs-live-demo">
          <span>LIVE RUST / WEBASSEMBLY</span>
          <p>Try this capability directly in your browser using verified synthetic fixtures.</p>
          <Link href={slug==='pczt-stage-regression'?'/tools/stages':'/tools/handoff'}>
            {slug==='pczt-stage-regression'?'Open Stage Comparator':'Open Role Handoff Runner'}
            <LuArrowUpRight size={16}/>
          </Link>
        </div>}
      <div className="docs-markdown">
        <Markdown remarkPlugins={[remarkGfm]} components={{
          a: ({ href, children }) => {
            const resolved = docsHref(href ?? '')
            return resolved.startsWith('/') && !resolved.startsWith('//') ?
              <Link href={resolved}>{children}</Link> :
              <a href={resolved} rel="noopener noreferrer" target="_blank">{children}</a>
          },
          h1: ({ children }) => <h2>{children}</h2>,
        }}>{content}</Markdown>
      </div>
      <nav className="docs-article-pagination" aria-label="Adjacent documentation">
        {previous ? <Link href={'/docs/' + previous.slug} className="docs-adjacent docs-adjacent-prev"><span><LuArrowLeft size={15}/> PREVIOUS</span><strong>{previous.title}</strong></Link> : <span/>}
        {next ? <Link href={'/docs/' + next.slug} className="docs-adjacent docs-adjacent-next"><span>NEXT <LuArrowUpRight size={15}/></span><strong>{next.title}</strong></Link> : <span/>}
      </nav>
      <div className="docs-article-end">
        <span>Public guides document shipped APIs and clearly identify partial integrations. Internal design, deployment and research notes remain in the source repository.</span>
        <Link href="/docs"><LuArrowLeft size={16}/> Documentation index</Link>
      </div>
    </article>
  </DocsLayout>
}
