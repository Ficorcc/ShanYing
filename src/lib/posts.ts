import { getCollection, type CollectionEntry } from 'astro:content'

export type Essay = CollectionEntry<'essay'>

/**
 * 文章路由 slug。
 *
 * Astro 7 不再往 entry 上挂 slug 字段（entry.slug 已废弃），但 frontmatter 里的
 * slug 依然在 entry.data 里。CMS 写入的 slug 优先，缺失时回退到文件名（entry.id）。
 */
export function entrySlug(entry: Essay): string {
  return entry.data.slug || entry.id
}

/** 取全部已发布文章，按时间倒序 */
export async function getPublishedEssays(): Promise<Essay[]> {
  const entries = await getCollection('essay', ({ data }) => !data.draft)
  return entries.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf())
}

/**
 * 按路由 slug 找文章。
 *
 * 文章详情页按请求渲染（评论区有运行期新增），SSR 模式下 getStaticPaths
 * 会被忽略，拿不到 props，所以要在请求期自己查一次。
 */
export async function getEssayBySlug(slug: string | undefined): Promise<Essay | undefined> {
  if (!slug) return undefined
  const essays = await getPublishedEssays()
  return essays.find((entry) => entrySlug(entry) === slug)
}
