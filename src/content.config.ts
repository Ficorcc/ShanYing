import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { z } from 'astro/zod'

/**
 * 文章集合。
 *
 * 目录结构刻意与 Ficor's Astro CMS 的 POSTS_DIR 保持一致：
 *   src/content/essay/*.md   —— 扁平存放，CMS 用 readdir 只读取当前层级
 *
 * frontmatter 字段与 CMS 的序列化格式一一对应：
 *   title / slug / date / updated / excerpt / tags / category / draft
 * CMS 额外写入的 badge 字段也一并接受，缺失时视为未使用。
 */
const essay = defineCollection({
  loader: glob({ base: './src/content/essay', pattern: '*.{md,mdx}' }),
  schema: z.object({
    title: z.string(),
    /** 覆盖默认路由，Astro 会用这个值生成 /essay/<slug> */
    slug: z.string().optional(),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    /** 作者；缺省时回落到站点作者 SITE.author */
    author: z.string().optional(),
    excerpt: z.string().default(''),
    tags: z.array(z.string()).default([]),
    category: z.string().default(''),
    badge: z.string().optional(),
    draft: z.boolean().default(false),

    /* --- 山映主题需要的可选字段（CMS 未写入时走默认值，不影响原有内容） --- */
    /** 封面图（主题的大图卡片、文章头图） */
    cover: z.string().optional(),
    coverAlt: z.string().optional(),
    /** 多分类；缺省时回落到 category */
    categories: z.array(z.string()).optional(),
    /** 内容提要 / 摘要，优先于 excerpt */
    summary: z.string().optional(),
    /** 浏览量 */
    views: z.number().int().optional(),
  }),
})

export const collections = { essay }
