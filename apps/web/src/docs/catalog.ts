import content from '../../content/docs/index.json'

export type Guide = {
  slug: string
  title: string
  group: string
  status: 'supported' | 'partial' | 'preview' | 'research'
  audience: string
  summary: string
}

export const guides: Guide[] = content.entries as Guide[]
export const guideGroups = [...new Set(guides.map(guide => guide.group))]
export function getGuide(slug: string): Guide | undefined {
  return guides.find(guide => guide.slug === slug)
}

export function docsHref(href: string): string {
  // Only known canonical docs are rewritten as internal links.
  const matched = href.match(/^(?:\.\/)?([a-z0-9][a-z0-9-]*)\.md(#[-\w]+)?$/)
  if (matched && getGuide(matched[1])) {
    return '/docs/' + matched[1] + (matched[2] || '')
  }
  if (href.startsWith('docs/')) {
    const relative = href.slice(5)
    return docsHref(relative)
  }
  return href
}
