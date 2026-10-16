import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { LuArrowLeft, LuArrowUpRight, LuGithub } from 'react-icons/lu'
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
  return <DocsLayout selected={slug}>
    <article className="docs-article">
      <div className="docs-article-heading">
        <span className="docs-kicker">{guide.group.toUpperCase()} / {guide.audience.toUpperCase()}</span>
        <h1>{guide.title}</h1>
        <p>{guide.summary}</p>
        <div className="docs-article-labels"><Status status={guide.status}/>
          <a href={'https://github.com/Oluwa-Laughter/zerynex/blob/main/docs/' + slug + '.md'} target="_blank" rel="noopener noreferrer"><LuGithub size={15}/> View canonical Markdown <LuArrowUpRight size={14}/></a>
        </div>
      </div>
      <div className="docs-markdown">
        <Markdown remarkPlugins={[remarkGfm]} components={{
          a: ({ href, children }) => {
            const resolved = docsHref(href ?? '')
            return resolved.startsWith('/docs/') ? <Link href={resolved}>{children}</Link> :
              <a href={resolved} rel="noopener noreferrer" target="_blank">{children}</a>
          },
          h1: ({ children }) => <h2>{children}</h2>,
        }}>{content}</Markdown>
      </div>
      <div className="docs-article-end">
        <span>This guide is maintained in the repository docs/ folder. Supported features have tested integrations; previews and research are labeled.</span>
        <Link href="/docs"><LuArrowLeft size={16}/> All documentation</Link>
      </div>
    </article>
  </DocsLayout>
}
