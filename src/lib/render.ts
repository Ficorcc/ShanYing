/**
 * HTML 片段渲染器。
 *
 * 山映主题的前端 JS 通过 `/api/ajax?action=...` 取回一整块 HTML 再插入页面
 * （对应原 WordPress 里的 `feng_*_ajax()` 回调）。这些片段必须由服务端渲染，
 * 因此统一收敛到这里，页面组件与 API 端点共用同一份实现。
 *
 * 所有输出都做了 HTML 转义，避免内容里的尖括号破坏结构。
 */
import { icon } from './icons';
import { relativeTime, type PostMeta } from './content';
import type { Comment } from './data';
import type { LinkItem } from '../data/links';

export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const dateLabel = (date: Date) =>
  `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;

const shortDate = (date: Date) =>
  `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;

/* ------------------------------------------------------------------ */
/* 分类文章列表（feng_hub）                                            */
/* ------------------------------------------------------------------ */

export interface CollectionListOptions {
  posts: PostMeta[];
  /** 分类名；'all' 表示全部文章 */
  category: string;
  /** 排序方式：latest / comments / views */
  type: 'latest' | 'comments' | 'views';
  page: number;
  totalPages: number;
  tint: string;
  cover?: string;
  categoryUrl: string;
}

const SORT_LABELS: Record<string, string> = {
  latest: '最新文章',
  comments: '热评文章',
  views: '浏览最多',
};

export function renderCollectionList(options: CollectionListOptions): string {
  const { posts, category, type, page, totalPages, tint, cover, categoryUrl } = options;
  const isAll = category === 'all';

  const sortNav = isAll
    ? Object.entries(SORT_LABELS)
        .map(
          ([key, label]) =>
            `<button type="button" data-hub-type="${key}" aria-pressed="${key === type}">${esc(label)}</button>`,
        )
        .join('')
    : `<a class="feng-hub-category-entry" href="${esc(categoryUrl)}" aria-label="进入${esc(category)}分类">进入分类 ${icon('arrow-up-right')}</a>`;

  const items = posts
    .map(
      (post) =>
        `<li><a href="${esc(post.url)}" data-category-preview="${esc(post.cover ?? cover ?? '')}"><span>${esc(post.title)}</span><time datetime="${esc(post.iso)}">${esc(shortDate(post.date))}</time></a></li>`,
    )
    .join('');

  const blanks = Array.from({ length: Math.max(0, 5 - posts.length) }, () => '<li class="feng-list-empty" aria-hidden="true"></li>').join('');

  return `<section class="feng-category-list" data-category-list data-xf-reveal style="--category-tint:${esc(tint)}" aria-labelledby="xf-group-${esc(category)}">
 <div class="feng-category-list__body">
  <header class="feng-hub-toolbar"><nav aria-label="文章排序">${sortNav}</nav><div class="feng-hub-pages"><button type="button" data-hub-page="${Math.max(1, page - 1)}" data-hub-sort="${esc(type)}" aria-label="上一页" ${page <= 1 ? 'disabled' : ''}>${icon('previous')}</button><span>${page} / ${Math.max(1, totalPages)}</span><button type="button" data-hub-page="${page + 1}" data-hub-sort="${esc(type)}" aria-label="下一页" ${page >= totalPages ? 'disabled' : ''}>${icon('next')}</button></div></header>
  <ol>${items}${blanks}</ol>
 </div>
 <div class="feng-category-list__picture" aria-hidden="true">
  ${
    cover
      ? `<img class="feng-category-list__base" src="${esc(cover)}" alt="" loading="lazy" decoding="async">`
      : `<span class="feng-category-list__placeholder">${esc(category)}</span>`
  }
  <img class="feng-category-list__preview" alt="" hidden><span class="feng-preview-loading"></span>
 </div>
</section>`;
}

/* ------------------------------------------------------------------ */
/* 最近一周动态（feng_activity）                                       */
/* ------------------------------------------------------------------ */

export interface ActivityEntry {
  kind: 'post' | 'talk';
  id: string;
  title: string;
  summary: string;
  url: string;
  iso: string;
  dateLabel: string;
  image?: string;
  tags?: string[];
}

export function renderActivityRows(entries: ActivityEntry[]): string {
  return entries
    .map((entry) => {
      const tagHtml = (entry.tags ?? [])
        .slice(0, 2)
        .map((tag) => `<span class="feng-activity-tag"># ${esc(tag)}</span>`)
        .join('');
      const body =
        entry.kind === 'talk'
          ? `<a class="feng-activity-talk" href="${esc(entry.url)}">${entry.summary ? `<p>${esc(entry.summary)}</p>` : '<span class="screen-reader-text">查看这条说说</span>'}</a>`
          : `<h3><a href="${esc(entry.url)}">${esc(entry.title)}</a></h3>${entry.summary ? `<p>${esc(entry.summary)}</p>` : ''}`;
      return `<article class="feng-activity-item${entry.image ? ' has-image' : ''}" data-activity-id="${esc(entry.id)}" data-activity-kind="${entry.kind}">
 <span class="feng-activity-mark" aria-hidden="true">${icon(entry.kind === 'talk' ? 'comment' : 'words')}</span>
 <div class="feng-activity-copy"><div class="feng-activity-meta"><span>${entry.kind === 'talk' ? '说说' : '文章'}</span><time datetime="${esc(entry.iso)}" title="${esc(entry.dateLabel)}">${esc(relativeTime(entry.iso))}前</time>${tagHtml}</div>
 ${body}</div>
 ${entry.image ? `<a class="feng-activity-image" href="${esc(entry.url)}" tabindex="-1" aria-hidden="true"><img src="${esc(entry.image)}" alt="" loading="lazy" decoding="async"></a>` : ''}
</article>`;
    })
    .join('');
}

/* ------------------------------------------------------------------ */
/* 热力图某天的记录（feng_heatmap_day）                                */
/* ------------------------------------------------------------------ */

export function renderHeatmapDay(entries: ActivityEntry[]): string {
  if (!entries.length) return '';
  return renderActivityRows(entries);
}

/* ------------------------------------------------------------------ */
/* 说说卡片（feng_talk_read）                                          */
/* ------------------------------------------------------------------ */

const TALK_ANGLES = [-1.4, 0.9, -0.6, 1.2, -0.8, 0.5];

/** 说说的最小结构：CMS 的 memos.json 与运行期新增的字段略有差异，这里只取共有的部分。 */
export interface TalkLike {
  id: string;
  content: string;
  createdAt: string;
  memosName?: string;
  keywords?: string[];
  location?: string;
  resources?: { name?: string; url?: string; filename?: string; type?: string }[];
}

export function renderTalkCard(memo: TalkLike, index: number): string {
  const angle = TALK_ANGLES[index % TALK_ANGLES.length];
  const shift = (index % 3) * 8;
  const date = new Date(memo.createdAt);
  const tags = memo.keywords ?? [];
  const tagHtml = tags
    .slice(0, 2)
    .map(
      (tag) =>
        `<button type="button" data-talk-tag="${esc(tag)}" style="--tag-color:#7aa2f7" aria-label="筛选关键词：${esc(tag)}">${icon('plus')}<span>${esc(tag)}</span></button>`,
    )
    .join('');
  const images = memo.resources ?? [];
  const imageHtml = images.length
    ? `<div class="feng-talk-card-images" data-count="${images.length}">${images
        .slice(0, 2)
        .map((resource) => `<img loading="lazy" decoding="async" src="${esc(resource.url ?? '')}" alt="${esc(resource.name ?? '')}">`)
        .join('')}${images.length > 2 ? `<span>+${images.length - 2}</span>` : ''}</div>`
    : '';

  return `<article class="feng-talk-card" data-talk-id="${esc(memo.id)}" style="--talk-angle:${angle}deg;--talk-shift:${shift}px">
 <div class="feng-talk-card-tags">${tagHtml}</div>
 <a class="feng-talk-card-open" href="#talk-${esc(memo.id)}" data-talk-open="${esc(memo.id)}" aria-label="展开说说：${esc(memo.content.slice(0, 40))}">
 <div class="feng-talk-card-copy"><time datetime="${esc(memo.createdAt)}" title="${esc(dateLabel(date))}">${esc(relativeTime(memo.createdAt))}</time><p>${esc(memo.content)}</p><div class="feng-talk-card-meta"><span>${memo.location ? `${icon('pin')} ${esc(memo.location)}` : ''}</span><span>via 网页</span></div></div>
 ${imageHtml}
 </a></article>`;
}

export function renderTalkBoard(memos: TalkLike[]): string {
  return memos.map((memo, index) => renderTalkCard(memo, index)).join('');
}

/* ------------------------------------------------------------------ */
/* 订阅动态（feng_feed_list）                                          */
/* ------------------------------------------------------------------ */

export interface FeedRow {
  title: string;
  url: string;
  date?: string;
  summary?: string;
  source: string;
}

export function renderFeedRows(rows: FeedRow[]): string {
  return rows
    .map(
      (row) => `<article class="feng-feed-entry" data-feed-entry>
 <span class="feng-feed-entry__mark" aria-hidden="true">${esc(row.source.slice(0, 1))}</span>
 <div class="feng-feed-entry__body">
  <div class="feng-feed-entry__meta"><span>${esc(row.source)}</span><span>·</span>${row.date ? `<time datetime="${esc(row.date)}">${esc(row.date)}</time>` : ''}</div>
  <h2><a href="${esc(row.url)}" target="_blank" rel="noopener noreferrer">${esc(row.title)}</a></h2>
  ${row.summary ? `<p>${esc(row.summary)}</p>` : ''}
 </div>
</article>`,
    )
    .join('');
}

/* ------------------------------------------------------------------ */
/* 控制面板（feng_dashboard）                                           */
/* ------------------------------------------------------------------ */

export interface DashboardData {
  summary: { label: string; value: number | null }[];
  categories: { name: string; count: number; description: string }[];
  recent: PostMeta[];
  recommended: PostMeta[];
  talks: { date: string; label: string; content: string }[];
  comments: { id: string; author: string; date: string; excerpt: string; url: string }[];
  tags: { name: string; count: number }[];
  friends: LinkItem[];
  calendar: string;
}

export function renderDashboard(data: DashboardData): string {
  const summary = data.summary
    .map(
      (item) =>
        `<div title="${esc(item.label)}"><strong${item.value !== null ? ' data-stat-roll' : ''}>${item.value === null ? '未设置' : item.value.toLocaleString('zh-CN')}</strong><span>${esc(item.label)}</span></div>`,
    )
    .join('');

  const categories = data.categories.length
    ? data.categories
        .map(
          (category) =>
            `<a href="/essay/category/${encodeURIComponent(category.name)}/"><span class="feng-dash-category-icon" aria-hidden="true">${icon('folder')}</span><span><strong>${esc(category.name)}</strong><small>${esc(category.description || `查看这个分类的文章`)}</small></span><b>${category.count}</b></a>`,
        )
        .join('')
    : '<p class="feng-dashboard-empty">还没有公开的文章分类。</p>';

  // 原主题的「最新文章 / 热门阅读」用 .feng-dashboard-posts 这套结构与样式
  // （ul > li > a > time + span，日期一列、标题一列），这里保持一致，
  // 不要换成自定义类名，否则会退回成没有样式的行内文字。
  const postRows = (posts: PostMeta[]) =>
    posts.length
      ? `<ul class="feng-dashboard-posts">${posts
          .map(
            (post) =>
              `<li><a href="${esc(post.url)}"><time datetime="${esc(post.iso)}">${esc(shortDate(post.date))}</time><span>${esc(post.title)}</span></a></li>`,
          )
          .join('')}</ul>`
      : '<p class="feng-dashboard-empty">还没有公开文章。</p>';

  const talks = data.talks.length
    ? data.talks
        .map(
          (talk) =>
            `<a href="/moments/"><time datetime="${esc(talk.date)}">${esc(talk.label)}</time><span>${esc(talk.content)}</span></a>`,
        )
        .join('')
    : '<p class="feng-dashboard-empty">还没有说说。</p>';

  const comments = data.comments.length
    ? data.comments
        .map(
          (comment) =>
            `<a class="feng-dashboard-comment" href="${esc(comment.url)}"><span class="feng-dashboard-avatar" aria-hidden="true">${esc(comment.author.slice(0, 1))}</span><span class="feng-dashboard-comment-text"><span class="feng-dashboard-byline"><strong>${esc(comment.author)}</strong><time datetime="${esc(comment.date)}">${esc(relativeTime(comment.date))}前</time></span><span class="feng-dashboard-excerpt">${esc(comment.excerpt)}</span></span></a>`,
        )
        .join('')
    : '<p class="feng-dashboard-empty">还没有留言，来留下第一句话吧。</p>';

  const tags = data.tags.length
    ? data.tags
        .map((tag) => `<a href="/tags/${encodeURIComponent(tag.name)}/">${esc(tag.name)}<small>${tag.count}</small></a>`)
        .join('')
    : '<p class="feng-dashboard-empty">还没有标签。</p>';

  const friends = data.friends.length
    ? data.friends
        .map(
          (friend) =>
            `<a href="${esc(friend.url)}" target="_blank" rel="noopener noreferrer"><span class="feng-dash-friend-avatar" aria-hidden="true">${esc(friend.name.slice(0, 1))}</span><span>${esc(friend.name)}</span></a>`,
        )
        .join('')
    : '<p class="feng-dashboard-empty">还没有公开的友情链接。</p>';

  return `<div class="feng-dashboard-summary" data-dashboard-summary aria-label="站点统计">${summary}</div>
<section class="feng-dash-section"><header><h2><i class="fa-solid fa-folder-open" aria-hidden="true"></i> 分类浏览</h2><a href="/archives/">全部存档</a></header><div class="feng-dash-categories">${categories}</div></section>
<div class="feng-dash-workspace"><div class="feng-dash-main">
<div class="feng-dash-reading">
<section class="feng-dash-section"><header><h2><i class="fa-solid fa-pen-nib" aria-hidden="true"></i> 最新文章</h2></header>${postRows(data.recent)}</section>
<section class="feng-dash-section"><header><h2><i class="fa-solid fa-bookmark" aria-hidden="true"></i> 热门阅读</h2></header>${postRows(data.recommended)}</section>
</div>
<section class="feng-dash-section"><header><h2><i class="fa-solid fa-comment-dots" aria-hidden="true"></i> 最近说说</h2><a href="/moments/">全部说说</a></header><div class="feng-dash-talks">${talks}</div></section>
<section class="feng-dash-section"><section class="feng-dashboard-conversations" aria-labelledby="feng-conversations-title">
 <div class="feng-dashboard-section-head"><h2 id="feng-conversations-title">${icon('comment')}最近评论</h2><a href="/guestbook/">去留言 ${icon('arrow-up-right')}</a></div>
 <div class="feng-dashboard-comments">${comments}</div>
</section>
</section></div><aside class="feng-dash-sidebar">
<section class="feng-dash-section"><header><h2><i class="fa-solid fa-calendar-days" aria-hidden="true"></i> 文章日历</h2></header><div data-feng-calendar>${data.calendar}</div></section>
<section class="feng-dash-section"><header><h2><i class="fa-solid fa-hashtag" aria-hidden="true"></i> 热门标签</h2></header><div class="feng-dashboard-tags">${tags}</div></section>
<section class="feng-dash-section"><header><h2>${icon('link')} 友情链接</h2><a href="/friends/">全部友链</a></header><div class="feng-dash-friends">${friends}</div></section>
</aside></div>`;
}

/* ------------------------------------------------------------------ */
/* Hero 活动数据（feng_hero_activity）                                 */
/* ------------------------------------------------------------------ */

export interface HeroActivityData {
  counts: Record<string, number>;
  badges: string;
  visitors: string;
}

export function renderHeroBadges(
  posts: number,
  talks: number,
  comments: number,
): string {
  return ['文章', '说说', '评论']
    .map((label, index) => {
      const value = [posts, talks, comments][index];
      return `<span title="全部 · ${label}">${label} <b>${value.toLocaleString('zh-CN')}</b></span>`;
    })
    .join('');
}

export function renderVisitors(entries: { name: string; url: string; avatar?: string }[]): string {
  if (!entries.length) return '<p class="feng-empty">最近还没有访客记录。</p>';
  return entries
    .map(
      (entry) =>
        `<a class="feng-visitor-chip" href="${esc(entry.url)}" target="_blank" rel="noopener noreferrer">${entry.avatar ? `<img src="${esc(entry.avatar)}" alt="" width="28" height="28" loading="lazy">` : `<span class="feng-visitor-initial" aria-hidden="true">${esc(entry.name.slice(0, 1))}</span>`}<span>${esc(entry.name)}</span></a>`,
    )
    .join('');
}

/** Hero 访客位（接口侧使用）。 */
export const renderHubVisitors = renderVisitors;

/* ------------------------------------------------------------------ */
/* GitHub 动态（feng_github_stats）                                    */
/* ------------------------------------------------------------------ */

export function renderGithubStats(
  stats: { pushes: number; projects: number; complete: boolean } | null,
): string {
  if (!stats) return '<small>GitHub 暂未同步</small>';
  const prefix = stats.complete ? '' : '至少 ';
  return `<small>${prefix}${stats.pushes} 次推送 · ${stats.projects} 个项目</small>`;
}

/* ------------------------------------------------------------------ */
/* 评论区（feng_comment 回调 / 静态渲染）                              */
/* ------------------------------------------------------------------ */

export function renderCommentItem(comment: Comment, anchor: string): string {
  const reply = comment.reply
    ? `<div class="feng-comment-reply"><strong>作者回复：</strong>${esc(comment.reply)}</div>`
    : '';
  // 结构对齐原主题 inc-comment.php 的 feng_comment()：
  // li.feng-comment > article.feng-comment__body > .feng-comment__avatar + .feng-comment__main
  return `<li class="feng-comment" id="${esc(anchor)}">
 <article class="feng-comment__body">
  <div class="feng-comment__avatar"><span class="feng-avatar-initial" aria-hidden="true">${esc(comment.author.slice(0, 1))}</span></div>
  <div class="feng-comment__main">
   <header class="feng-comment__heading"><div class="feng-comment__identity"><b>${esc(comment.author)}</b><time class="feng-comment__date feng-comment-tip" tabindex="0" datetime="${esc(comment.date)}">${esc(relativeTime(comment.date))}</time></div></header>
   <div class="feng-comment__text"><p>${esc(comment.content)}</p>${reply}</div>
  </div>
 </article>
</li>`;
}
