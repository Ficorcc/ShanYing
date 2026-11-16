import rss from '@astrojs/rss'
import { getCollection } from 'astro:content'
import { SITE } from '../config/site'
import { entrySlug } from '../lib/posts'

export async function GET(context: { site?: URL }) {
  const essays = await getCollection('essay', ({ data }) => !data.draft)
  const site = context.site ?? new URL(SITE.url)

  return rss({
    title: SITE.title,
    description: SITE.description,
    site,
    trailingSlash: false,
    customData: `<language>${SITE.lang}</language><author>${SITE.email}</author>`,
    items: essays.map((entry) => ({
      title: entry.data.title,
      pubDate: entry.data.date,
      description: entry.data.excerpt,
      categories: [entry.data.category, ...entry.data.tags].filter(Boolean),
      link: `/essay/${entrySlug(entry)}`,
    })),
  })
}
