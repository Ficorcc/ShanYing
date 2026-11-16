/**
 * 内容模型层。
 *
 * 把 Astro 内容集合 + CMS 的 JSON 数据统一成纯对象，
 * 供 Astro 组件与 /api 端点的 HTML 渲染器共用。
 */
import { entrySlug, getPublishedEssays, type Essay } from './posts';
import { comments, links, memos, type Memo } from './data';
import type { LinkItem } from '../data/links';
import { SITE } from '../config/site';

export type { Essay };

export interface PostMeta {
  slug: string;
  title: string;
  url: string;
  date: Date;
  iso: string;
  dateLabel: string;
  author: string;
  category: string;
  categories: string[];
  tags: string[];
  cover?: string;
  excerpt: string;
  summary?: string;
  views: number;
  commentCount: number;
  body: string;
}

export const POST_BASE = '/essay';

export function postUrl(slug: string): string {
  return `${POST_BASE}/${slug}`;
}

export function toPostMeta(entry: Essay): PostMeta {
  const slug = entrySlug(entry);
  const categories = entry.data.categories?.length
    ? entry.data.categories
    : entry.data.category
      ? [entry.data.category]
      : [];
  const date = entry.data.date;
  return {
    slug,
    title: entry.data.title || '无标题',
    url: postUrl(slug),
    date,
    iso: date.toISOString(),
    dateLabel: `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`,
    author: entry.data.author || SITE.author,
    category: entry.data.category || '未分类',
    categories,
    tags: entry.data.tags ?? [],
    cover: entry.data.cover,
    excerpt: entry.data.excerpt ?? '',
    summary: entry.data.summary,
    views: entry.data.views ?? 0,
    commentCount: comments.filter((c) => c.postId === slug && c.approved).length,
    body: entry.body ?? '',
  };
}

/** 已发布文章，按时间倒序。 */
export async function getPublished(): Promise<Essay[]> {
  return getPublishedEssays();
}

/** 已发布文章的元数据视图。 */
export async function getPublishedMeta(): Promise<PostMeta[]> {
  return (await getPublished()).map(toPostMeta);
}

/** 按分类分组，返回 Map<分类, 文章[]>。 */
export function groupByCategory(posts: PostMeta[]): Map<string, PostMeta[]> {
  const map = new Map<string, PostMeta[]>();
  for (const post of posts) {
    for (const category of post.categories.length ? post.categories : [post.category]) {
      const bucket = map.get(category) ?? [];
      bucket.push(post);
      map.set(category, bucket);
    }
  }
  return map;
}

/** 按标签分组。 */
export function groupByTag(posts: PostMeta[]): Map<string, PostMeta[]> {
  const map = new Map<string, PostMeta[]>();
  for (const post of posts) {
    for (const tag of post.tags) {
      const bucket = map.get(tag) ?? [];
      bucket.push(post);
      map.set(tag, bucket);
    }
  }
  return map;
}

/** 分类清单（含描述与封面占位）。 */
export function categoryList(posts: PostMeta[]): { name: string; count: number; posts: PostMeta[] }[] {
  return [...groupByCategory(posts).entries()]
    .map(([name, items]) => ({ name, count: items.length, posts: items }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'));
}

/** 标签清单。 */
export function tagList(posts: PostMeta[]) {
  return [...groupByTag(posts).entries()]
    .map(([name, items]) => ({ name, count: items.length }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'));
}

/** 公开说说。 */
export function publicMemos(): Memo[] {
  return memos
    .filter((memo) => memo.visibility === 'PUBLIC')
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.createdAt.localeCompare(a.createdAt);
    });
}

/** 启用的友链。 */
export function activeLinks(): LinkItem[] {
  return links.filter((link) => link.is_active !== false);
}

/** 相对时间：3 分钟前 / 2 小时前 / 5 天前。 */
export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(0, Math.round(diff / 60000));
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} 天前`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} 个月前`;
  return `${Math.round(months / 12)} 年前`;
}

/** 中文正文按字、英文按词统计。 */
export function wordCount(text: string): number {
  const cjk = (text.match(/[\u4e00-\u9fa5]/g) ?? []).length;
  const words = text.replace(/[\u4e00-\u9fa5]/g, ' ').split(/\s+/).filter(Boolean).length;
  return cjk + words;
}

/** 预计阅读时长（分钟）。 */
export function readingMinutes(text: string): number {
  const cjk = (text.match(/[\u4e00-\u9fa5]/g) ?? []).length;
  const words = text.replace(/[\u4e00-\u9fa5]/g, ' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(cjk / 350 + words / 220));
}

/** 站点全部文章字数。 */
export function siteWordCount(posts: PostMeta[]): number {
  return posts.reduce((sum, post) => sum + wordCount(post.body), 0);
}

/** 按天统计发布量，供热力图使用。键为 YYYY-MM-DD。 */
export function activityCounts(posts: PostMeta[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const post of posts) {
    const key = `${post.date.getFullYear()}-${String(post.date.getMonth() + 1).padStart(2, '0')}-${String(
      post.date.getDate(),
    ).padStart(2, '0')}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}
