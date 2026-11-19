#!/usr/bin/env node
/**
 * 刷新订阅源数据。
 *
 * 数据流：**友链的 `feed` 字段 → 订阅源列表 → 订阅页展示**。
 *   - 读 src/data/links.ts，取出所有启用中的友链；
 *   - 带 `feed`（RSS 地址）的友链进入 src/config/feed.json 的 subscriptions；
 *   - 逐个抓取 RSS，把最新文章写进 latestItems，并记录 updated 时间；
 *   - 不带 feed 的友链只出现在友链页，不会进订阅页。
 *
 * 用法：
 *   node scripts/refresh-feeds.mjs            # 正常刷新
 *   node scripts/refresh-feeds.mjs --dry-run  # 只打印，不写文件
 *
 * 不依赖任何第三方包：RSS / Atom 都用正则解析，够用即可。
 */
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const LINKS_FILE = path.join(ROOT, 'src/data/links.ts')
const SITE_FILE = path.join(ROOT, 'src/config/site.ts')
const FEED_FILE = path.join(ROOT, 'src/config/feed.json')
const DRY_RUN = process.argv.includes('--dry-run')
/** 每个订阅源最多保留多少篇 */
const MAX_ITEMS = 12

/* ------------------------------------------------------------------ */
/* 读取                                                                */
/* ------------------------------------------------------------------ */

const read = (file) => readFile(file, 'utf8')

/** 从 links.ts 里挑出友链条目（对象字面量逐个解析）。 */
function parseLinks(source) {
  const listMatch = source.match(/export const links[^=]*=\s*\[([\s\S]*?)\n\]/)
  if (!listMatch) throw new Error('links.ts 里没找到 links 数组')
  const body = listMatch[1]
  const entries = []
  // 行首匹配，避免 'subtitle:' 里的 'title:' 被误当成字段
  const field = (block, name) => {
    const match = block.match(new RegExp(`^\\s*${name}:\\s*['\"]([^'\"]*)['\"]`, 'm'))
    return match ? match[1] : ''
  }
  for (const block of body.split(/\n  \{/).slice(1)) {
    const id = field(block, 'id')
    if (!id) continue
    entries.push({
      id,
      name: field(block, 'name'),
      url: field(block, 'url'),
      description: field(block, 'description'),
      avatar: field(block, 'avatar'),
      feed: field(block, 'feed'),
      isActive: !/is_active:\s*false/.test(block),
    })
  }
  return entries
}

/** 从 site.ts 里取站点信息。 */
function parseSite(source) {
  // 行首匹配，避免 'subtitle:' 里的 'title:' 被误当成字段
  const pick = (key) => {
    const match = source.match(new RegExp(`^\\s*${key}:\\s*['\"]([^'\"]*)['\"]`, 'm'))
    return match ? match[1] : ''
  }
  return {
    title: pick('title'),
    subtitle: pick('subtitle'),
    description: pick('description'),
    url: pick('url'),
    author: pick('author'),
    language: pick('lang'),
  }
}

/* ------------------------------------------------------------------ */
/* RSS 解析                                                            */
/* ------------------------------------------------------------------ */

const decodeEntities = (text) =>
  text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim()

const stripTags = (html) =>
  decodeEntities(String(html).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()

const tagValue = (block, name) => {
  const match = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'))
  return match ? decodeEntities(match[1]) : ''
}

const toIso = (raw) => {
  if (!raw) return undefined
  const date = new Date(raw.trim())
  if (Number.isNaN(date.valueOf())) return undefined
  return date.toISOString()
}

/** 解析 RSS 2.0 / Atom，输出按时间倒序的文章列表。 */
function parseFeed(xml) {
  const blocks = [
    ...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi),
    ...xml.matchAll(/<entry[\s>][\s\S]*?<\/entry>/gi),
  ].map((match) => match[0])

  const items = blocks.map((block) => {
    const title = stripTags(tagValue(block, 'title'))
    const linkMatch =
      block.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i) ??
      block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)
    const url = linkMatch ? decodeEntities(linkMatch[1]) : ''
    const date =
      toIso(tagValue(block, 'pubDate')) ??
      toIso(tagValue(block, 'published')) ??
      toIso(tagValue(block, 'updated')) ??
      toIso(tagValue(block, 'dc:date'))
    const summary = stripTags(tagValue(block, 'description') || tagValue(block, 'summary') || tagValue(block, 'content'))
    return { title, url, date, summary }
  })

  return items
    .filter((item) => item.title && item.url)
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
}

/* ------------------------------------------------------------------ */
/* 抓取                                                                */
/* ------------------------------------------------------------------ */

async function fetchFeed(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20000)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'user-agent': 'FicorHistory/1.0 (+https://ficor.cn)' },
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.text()
  } finally {
    clearTimeout(timer)
  }
}

/* ------------------------------------------------------------------ */
/* 主流程                                                              */
/* ------------------------------------------------------------------ */

const linksSource = await read(LINKS_FILE)
const siteSource = await read(SITE_FILE)
const links = parseLinks(linksSource)
const site = parseSite(siteSource)

// 友链里有订阅地址的，才算订阅源
const candidates = links.filter((link) => link.isActive && link.feed)
const subscriptions = []

for (const link of candidates) {
  process.stdout.write(`· ${link.name} ${link.feed} … `)
  let items = []
  let updated = ''
  try {
    const xml = await fetchFeed(link.feed)
    items = parseFeed(xml).slice(0, MAX_ITEMS)
    updated = items[0]?.date ?? ''
    console.log(`抓到 ${items.length} 篇${updated ? `，最新 ${updated.slice(0, 10)}` : ''}`)
  } catch (error) {
    console.log(`抓取失败（${error.message}），保留原有条目`)
    const previous = JSON.parse(await read(FEED_FILE))
    const old = previous.subscriptions?.find((item) => item.feedUrl === link.feed)
    if (old) {
      items = old.latestItems ?? []
      updated = old.updated ?? ''
    }
  }
  subscriptions.push({
    name: link.name,
    url: link.url,
    feedUrl: link.feed,
    avatar: link.avatar,
    description: link.description,
    updated,
    latestItems: items,
  })
}

const feed = {
  siteTitle: site.title,
  siteDescription: site.subtitle || site.description,
  siteUrl: site.url,
  feedUrl: `${site.url.replace(/\/$/, '')}/rss.xml`,
  author: site.author,
  language: site.language,
  subscriptions,
}

console.log(
  `\n订阅源 ${subscriptions.length} 个，文章 ${subscriptions.reduce((sum, item) => sum + item.latestItems.length, 0)} 篇`,
)

if (DRY_RUN) {
  console.log('--dry-run：没有写入文件')
} else {
  await writeFile(FEED_FILE, `${JSON.stringify(feed, null, 2)}\n`, 'utf8')
  console.log(`✓ 已写入 ${path.relative(ROOT, FEED_FILE)}`)
}
