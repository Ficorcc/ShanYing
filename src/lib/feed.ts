/**
 * 订阅源抓取。
 *
 * 数据来源有两层：
 *   1. **构建期**：`src/config/feed.json` 里的 `subscriptions`（由友链的 `feed` 字段生成，
 *      见 `scripts/refresh-feeds.mjs`），里面存着上一次抓到的文章，作为兜底数据；
 *   2. **运行期**：访问订阅页时按订阅地址现抓 RSS，抓到就更新缓存。
 *
 * 抓不到（对方站点挂了、网络不通、超时）时自动回落到第 1 层，
 * 所以订阅页永远不会因为外部站点出问题而变空。
 */
import { feed, type FeedItem, type Subscription } from './data';

/** 每个订阅源最多保留多少篇 */
const MAX_ITEMS = 12;
/** 抓取超时 */
const TIMEOUT_MS = 12000;
/** 缓存有效期：30 分钟内直接用缓存，不重复打扰对方的服务器 */
const CACHE_TTL = 30 * 60 * 1000;

interface CacheEntry {
  at: number;
  subscriptions: Subscription[];
}

let cache: CacheEntry | null = null;

/* ------------------------------------------------------------------ */
/* RSS / Atom 解析                                                     */
/* ------------------------------------------------------------------ */

const decodeEntities = (text: string) =>
  text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim();

const stripTags = (html: string) =>
  decodeEntities(String(html).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

const tagValue = (block: string, name: string) => {
  const match = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return match ? decodeEntities(match[1]) : '';
};

const toIso = (raw: string): string | undefined => {
  if (!raw) return undefined;
  const date = new Date(raw.trim());
  if (Number.isNaN(date.valueOf())) return undefined;
  return date.toISOString();
};

/** 解析 RSS 2.0 / Atom，返回按发布时间倒序的文章列表。 */
export function parseFeedXml(xml: string): FeedItem[] {
  const blocks = [
    ...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi),
    ...xml.matchAll(/<entry[\s>][\s\S]*?<\/entry>/gi),
  ].map((match) => match[0]);

  const items = blocks.map((block) => {
    const linkMatch =
      block.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i) ??
      block.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
    return {
      title: stripTags(tagValue(block, 'title')),
      url: linkMatch ? decodeEntities(linkMatch[1]) : '',
      date:
        toIso(tagValue(block, 'pubDate')) ??
        toIso(tagValue(block, 'published')) ??
        toIso(tagValue(block, 'updated')) ??
        toIso(tagValue(block, 'dc:date')),
      summary: stripTags(
        tagValue(block, 'description') || tagValue(block, 'summary') || tagValue(block, 'content'),
      ),
    };
  });

  return items
    .filter((item) => item.title && item.url)
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
}

/* ------------------------------------------------------------------ */
/* 抓取                                                                */
/* ------------------------------------------------------------------ */

async function fetchOne(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'user-agent': 'FicorHistory/1.0 (+https://ficor.cn)' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

/** 抓一个订阅源；失败返回 null（调用方负责回落）。 */
async function refreshSubscription(source: Subscription): Promise<Subscription | null> {
  try {
    const xml = await fetchOne(source.feedUrl);
    const latestItems = parseFeedXml(xml).slice(0, MAX_ITEMS);
    if (!latestItems.length) return null;
    return {
      ...source,
      updated: latestItems[0]?.date ?? source.updated ?? '',
      latestItems,
    };
  } catch {
    return null;
  }
}

/**
 * 取订阅源列表（含最新文章）。
 *
 * @param force 忽略缓存，强制重新抓取（订阅页的「刷新」按钮用）
 */
export async function loadSubscriptions(force = false): Promise<Subscription[]> {
  const sources = feed.subscriptions ?? [];
  if (!sources.length) return [];

  const now = Date.now();
  if (!force && cache && now - cache.at < CACHE_TTL) {
    return cache.subscriptions;
  }

  const results = await Promise.all(sources.map((source) => refreshSubscription(source)));
  // 抓到的用新数据，抓不到的保留构建期那份
  const merged = sources.map((source, index) => results[index] ?? source);
  const ok = results.some(Boolean);
  if (ok) cache = { at: now, subscriptions: merged };
  return merged;
}

/** 供构建期脚本与调试使用：清掉内存缓存。 */
export function clearFeedCache() {
  cache = null;
}
