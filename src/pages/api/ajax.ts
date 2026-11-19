/**
 * 山映主题的 AJAX 调度器。
 *
 * 原 WordPress 主题把 20 多个 AJAX 动作挂在 `admin-ajax.php` 上，
 * 前端用 `?action=feng_xxx` 调度。这里用同一个 URL 形状承接：
 *
 *   GET/POST /api/ajax?action=feng_xxx[&其他参数]
 *
 * 响应信封保持 `{ success, data }` 双层结构 —— 前端读的是 `result.data.*`，
 * 少一层就会全部落到「暂时无法…」的兜底分支。
 *
 * 契约详见 docs/frontend-contract.md。
 */
export const prerender = false;

import type { APIRoute } from 'astro';
import {
  getPublishedMeta,
  categoryList,
  tagList,
  activityCounts,
  siteWordCount,
  activeLinks,
  type PostMeta,
} from '../../lib/content';
import { type Comment } from '../../lib/data';
import {
  renderActivityRows,
  renderCollectionList,
  renderDashboard,
  renderFeedRows,
  renderHeatmapDay,
  renderHeroBadges,
  renderHubVisitors,
  renderTalkBoard,
  type ActivityEntry,
} from '../../lib/render';
import { activityCalendar } from '../../lib/calendar';
import { loadSubscriptions } from '../../lib/feed';
import { getStore, updateStore, type StoredComment } from '../../lib/store';
import { loadTalks as sharedLoadTalks, type MergedTalk } from '../../lib/talks';
import { loadAllComments } from '../../lib/comments';
import { readSession } from '../../lib/admin-session';
import {
  petIssueTicket,
  petRecord,
  petSnapshot,
  petVerifyTicket,
  type PetSnapshot,
} from '../../lib/pet';
import { SITE } from '../../config/site';
import { THEME } from '../../lib/theme';

/* ------------------------------------------------------------------ */
/* 基础工具                                                            */
/* ------------------------------------------------------------------ */

function ok(data: unknown = {}) {
  return new Response(JSON.stringify({ success: true, data }), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function fail(message: string, status = 400) {
  return new Response(JSON.stringify({ success: false, data: { message } }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

async function readParams(request: Request): Promise<URLSearchParams> {
  const url = new URL(request.url);
  const params = new URLSearchParams(url.search);
  if (request.method === 'POST') {
    const type = request.headers.get('content-type') ?? '';
    try {
      if (type.includes('application/json')) {
        const body = (await request.json()) as Record<string, unknown>;
        for (const [key, value] of Object.entries(body)) params.set(key, String(value));
      } else if (type.includes('form')) {
        const body = await request.formData();
        for (const [key, value] of body.entries()) {
          if (typeof value === 'string') params.set(key, value);
        }
      }
    } catch {
      /* 解析失败时退回只使用 query 参数 */
    }
  }
  return params;
}

const num = (value: string | null, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const pad = (value: number) => String(value).padStart(2, '0');
const iso = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const shortDate = (date: Date) =>
  `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;

/* ------------------------------------------------------------------ */
/* 数据聚合                                                            */
/* ------------------------------------------------------------------ */

async function loadPosts(): Promise<PostMeta[]> {
  return getPublishedMeta();
}

/** 说说：CMS 里的 memos.json + 运行期新增（与前台说说页共用同一聚合逻辑）。 */
async function loadTalks(): Promise<MergedTalk[]> {
  return sharedLoadTalks();
}

/** 评论：CMS 里的 comments.json + 运行期新增（与前台评论区共用同一聚合逻辑）。 */
async function loadComments(): Promise<Comment[]> {
  return loadAllComments();
}

/** 最近动态条目（文章 + 说说），用于热力图与动态流。 */
async function activityEntries(posts: PostMeta[]): Promise<ActivityEntry[]> {
  const talks = await loadTalks();
  const entries: ActivityEntry[] = posts.map((post) => ({
    kind: 'post' as const,
    id: post.slug,
    title: post.title,
    summary: post.excerpt.slice(0, 140),
    url: post.url,
    iso: post.iso,
    dateLabel: post.dateLabel,
    image: post.cover,
  }));
  for (const talk of talks) {
    const date = new Date(talk.createdAt);
    entries.push({
      kind: 'talk',
      id: talk.id,
      title: '说说',
      summary: talk.content.slice(0, 180),
      url: `/moments/#talk-${talk.id}`,
      iso: talk.createdAt,
      dateLabel: `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`,
      image: talk.resources?.[0]?.url,
      tags: talk.keywords,
    });
  }
  return entries.sort((a, b) => b.iso.localeCompare(a.iso));
}

/* ------------------------------------------------------------------ */
/* 动作实现                                                            */
/* ------------------------------------------------------------------ */

async function actionActivity(params: URLSearchParams) {
  const posts = await loadPosts();
  const entries = await activityEntries(posts);
  const perPage = 6;
  const pages = Math.max(1, Math.ceil(entries.length / perPage));
  const page = Math.min(pages, Math.max(1, num(params.get('page'), 1)));
  const slice = entries.slice((page - 1) * perPage, page * perPage);
  return ok({ html: renderActivityRows(slice), page, pages });
}

async function actionHub(params: URLSearchParams) {
  const posts = await loadPosts();
  const raw = params.get('category') ?? 'all';
  const category = raw === 'all' || raw === '0' ? 'all' : decodeURIComponent(raw);
  const type = (params.get('type') ?? 'latest') as 'latest' | 'comments' | 'views';
  const perPage = 6;

  let pool = posts;
  if (category !== 'all') {
    pool = posts.filter((post) => post.categories.includes(category));
  }

  if (type === 'comments') {
    pool = [...pool].sort((a, b) => b.commentCount - a.commentCount);
  } else if (type === 'views') {
    pool = [...pool].sort((a, b) => b.views - a.views);
  }

  const totalPages = Math.max(1, Math.ceil(pool.length / perPage));
  const page = Math.min(totalPages, Math.max(1, num(params.get('page'), 1)));
  const slice = pool.slice((page - 1) * perPage, page * perPage);
  const cover = slice[0]?.cover ?? pool[0]?.cover;

  const html = renderCollectionList({
    posts: slice,
    category,
    type,
    page,
    totalPages,
    tint: category === '旅行' ? '#f1f6f0' : category === '代码' ? '#f0f4fb' : '#f5f4f2',
    cover,
    categoryUrl: `/essay/category/${encodeURIComponent(category)}/`,
  });

  return ok({ html });
}

async function actionHeroActivity() {
  const posts = await loadPosts();
  const talks = await loadTalks();
  const allComments = await loadComments();

  const counts = activityCounts(posts);
  for (const talk of talks) {
    const key = iso(new Date(talk.createdAt));
    counts[key] = (counts[key] ?? 0) + 1;
  }

  const badges = renderHeroBadges(posts.length, talks.length, allComments.length);
  const visitors = renderHubVisitors([]);

  return ok({ counts, badges, visitors });
}

async function actionHeatmapDay(params: URLSearchParams) {
  const date = params.get('date') ?? '';
  const posts = await loadPosts();
  const entries = await activityEntries(posts);
  const day = entries.filter((entry) => entry.iso.slice(0, 10) === date);
  return ok({ html: renderHeatmapDay(day) });
}

async function actionDashboard(params: URLSearchParams) {
  const posts = await loadPosts();
  const talks = await loadTalks();
  const allComments = await loadComments();
  const part = params.get('part') ?? '';

  if (part === 'calendar') {
    const month = params.get('month') ?? '';
    const [year, mon] = month.split('-').map((value) => num(value, 0));
    const counts = activityCounts(posts);
    const html = activityCalendar({
      counts,
      year: year || new Date().getFullYear(),
      title: '文章更新记录',
    });
    return ok({ html });
  }

  const categories = categoryList(posts);
  const tags = tagList(posts);
  const friends = activeLinks();
  const words = siteWordCount(posts);

  const html = renderDashboard({
    summary: [
      { label: '文章', value: posts.length },
      { label: '分类', value: categories.length },
      { label: '标签', value: tags.length },
      { label: '说说', value: talks.length },
      { label: '评论', value: allComments.length },
      { label: '总字数', value: words },
      { label: '建站天数', value: Math.max(1, Math.round((Date.now() - new Date(THEME.site_since).getTime()) / 86400000)) },
    ],
    categories: categories.map((category) => ({
      name: category.name,
      count: category.count,
      description: `查看这个分类的文章`,
    })),
    recent: posts.slice(0, 5),
    recommended: [...posts].sort((a, b) => b.views - a.views).slice(0, 5),
    talks: talks.slice(0, 5).map((talk) => {
      const date = new Date(talk.createdAt);
      return {
        date: talk.createdAt,
        label: `${pad(date.getMonth() + 1)}.${pad(date.getDate())}`,
        content: talk.content.slice(0, 100),
      };
    }),
    comments: allComments
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 6)
      .map((comment) => ({
        id: comment.id,
        author: comment.author,
        date: comment.date,
        excerpt: comment.content.slice(0, 90),
        url: comment.postId === 'guestbook' ? '/guestbook/' : `/essay/${comment.postId}/#comment-${comment.id}`,
      })),
    tags,
    friends,
    calendar: activityCalendar({ counts: activityCounts(posts) }),
  });

  return ok({ html });
}

async function actionRandomArticle(params: URLSearchParams) {
  const posts = await loadPosts();
  const exclude = params.get('exclude') ?? '';
  const pool = posts.filter((post) => post.slug !== exclude);
  if (!pool.length) return fail('还没有可以随机阅读的文章。');
  const picked = pool[Math.floor(Math.random() * pool.length)];
  return ok({ url: picked.url });
}

/** 从主题配置里解析 GitHub 用户名；未配置时返回空串。 */
function githubUsername(): string {
  const url = THEME.social_github.trim();
  const match = url.match(/github\.com\/([^/?#]+)/i);
  return match ? match[1] : '';
}

async function actionGithubStats() {
  // GitHub 公开事件接口无需密钥，但有速率限制；拿不到就返回空，前端会显示「GitHub 暂未同步」。
  // 用户名取自主题配置（THEME.social_github），没配就当作不可用。
  const username = githubUsername();
  if (!username) return ok({ html: '<small>GitHub 暂未同步</small>' });
  try {
    const response = await fetch(`https://api.github.com/users/${username}/events/public`, {
      headers: { 'user-agent': 'shanying-astro' },
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) return ok({ html: '<small>GitHub 暂未同步</small>' });
    const events = (await response.json()) as { type: string; repo?: { name: string } }[];
    const since = Date.now() - 7 * 86400000;
    const recent = events.filter(
      (event) => new Date((event as { created_at?: string }).created_at ?? 0).getTime() > since,
    );
    const pushes = recent.filter((event) => event.type === 'PushEvent').length;
    const projects = new Set(recent.map((event) => event.repo?.name).filter(Boolean)).size;
    const html = `<small>${pushes} 次推送 · ${projects} 个项目</small>`;
    return ok({ html });
  } catch {
    return ok({ html: '<small>GitHub 暂未同步</small>' });
  }
}

async function actionGreetingIdentity() {
  return ok({ name: '' });
}
async function actionWeather(params: URLSearchParams) {
  const kind = params.get('kind') === 'visitor' ? 'visitor' : 'host';
  const service = THEME.greeting_weather_service;

  try {
    let latitude: number;
    let longitude: number;
    let city = '';
    let countryCode = '';

    if (kind === 'visitor') {
      if (!THEME.weather_visitor) return ok(null);
      const ip =
        Astro.request.headers.get('cf-connecting-ip') ??
        Astro.request.headers.get('x-real-ip') ??
        Astro.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
      if (!ip) return ok(null);
      const geo = await fetch(`https://ipwho.is/${ip}`, {
        signal: AbortSignal.timeout(6000),
      });
      const geoData = (await geo.json()) as {
        success?: boolean;
        latitude?: number;
        longitude?: number;
        city?: string;
        country_code?: string;
      };
      if (!geoData.success || !Number.isFinite(geoData.latitude) || !Number.isFinite(geoData.longitude)) {
        return ok(null);
      }
      latitude = geoData.latitude!;
      longitude = geoData.longitude!;
      city = geoData.city ?? '';
      countryCode = geoData.country_code ?? '';
    } else {
      const name = THEME.profile_location || SITE.title;
      const geo = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=zh&format=json`,
        { signal: AbortSignal.timeout(6000) },
      );
      const geoData = (await geo.json()) as {
        results?: { latitude: number; longitude: number; name: string; country?: string }[];
      };
      const result = geoData.results?.[0];
      if (!result) return ok(null);
      latitude = result.latitude;
      longitude = result.longitude;
      city = result.name;
    }

    const forecast = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude.toFixed(2)}&longitude=${longitude.toFixed(
        2,
      )}&current=temperature_2m,weather_code,is_day&daily=sunrise,sunset&forecast_days=2&timeformat=unixtime&timezone=auto`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!forecast.ok) return ok(null);
    const data = (await forecast.json()) as {
      current?: { temperature_2m?: number; weather_code?: number; is_day?: number; time?: string };
      daily?: { sunrise?: number[]; sunset?: number[] };
      timezone?: string;
      utc_offset_seconds?: number;
    };
    const current = data.current;
    if (!current || !Number.isFinite(current.temperature_2m)) return ok(null);

    return ok({
      city,
      country_code: countryCode,
      latitude,
      longitude,
      temperature: Math.round(current.temperature_2m as number),
      code: current.weather_code ?? 0,
      day: Boolean(current.is_day),
      time: current.time,
      timezone: data.timezone,
      utc_offset: data.utc_offset_seconds ?? 0,
      sunrise: data.daily?.sunrise ?? [],
      sunset: data.daily?.sunset ?? [],
    });
  } catch {
    return ok(null);
  }
}

async function actionVisitorStats(params: URLSearchParams) {
  const visitor = params.get('visitor') ?? 'anonymous';
  const store = await getStore();
  const now = Date.now();
  const activeWindow = 5 * 60 * 1000;

  const online = Object.values(store.visitors).filter((seen) => now - seen < activeWindow).length;
  const views = store.pageViews;

  await updateStore((draft) => {
    draft.visitors[visitor] = now;
    // 只保留最近 1 小时的记录，避免文件无限增长
    for (const [key, seen] of Object.entries(draft.visitors)) {
      if (now - seen > 3600 * 1000) delete draft.visitors[key];
    }
    if (params.get('event')) draft.pageViews += 1;
  });

  let location: { label: string; code: string } | null = null;
  try {
    const ip =
      Astro.request.headers.get('cf-connecting-ip') ??
      Astro.request.headers.get('x-real-ip') ??
      Astro.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    if (ip) {
      const geo = await fetch(`https://api.cnip.io/geoip/${ip}`, {
        signal: AbortSignal.timeout(4000),
      });
      const geoData = (await geo.json()) as {
        country?: string;
        country_code?: string;
        city?: string;
      };
      if (geoData.country) {
        location = {
          label: [geoData.city, geoData.country].filter(Boolean).join(' · '),
          code: (geoData.country_code ?? '').toLowerCase(),
        };
      }
    }
  } catch {
    /* 定位失败不影响统计 */
  }

  return ok({ online: Math.max(online, 1), views, location });
}

async function actionFeedCount() {
  const sources = await loadSubscriptions();
  const today = new Date().toISOString().slice(0, 10);
  const count = sources.reduce(
    (sum, source) =>
      sum + (source.latestItems ?? []).filter((item) => (item.date ?? '').startsWith(today)).length,
    0,
  );
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0);
  return ok({ today: count, midnight: Math.floor(midnight.getTime() / 1000) });
}

async function actionFeedList(params: URLSearchParams) {
  const sources = await loadSubscriptions();
  const onlyToday = params.get('today') === '1';
  const today = new Date().toISOString().slice(0, 10);

  const rows = sources.flatMap((source) =>
    (source.latestItems ?? [])
      .filter((item) => !onlyToday || (item.date ?? '').startsWith(today))
      .map((item) => ({
        title: item.title,
        url: item.url,
        date: item.date,
        summary: item.summary,
        source: source.name,
      })),
  );

  const perPage = 30;
  const total = rows.length;
  const page = Math.max(1, num(params.get('page'), 1));
  const slice = rows.slice((page - 1) * perPage, page * perPage);

  return ok({
    html: renderFeedRows(slice),
    total,
    more: page * perPage < total,
    page,
  });
}

async function actionTalkRead(params: URLSearchParams, request: Request) {
  const op = params.get('op') ?? 'list';
  const talks = await loadTalks();

  if (op === 'session') {
    const tags = new Map<string, number>();
    for (const talk of talks) {
      for (const keyword of talk.keywords ?? []) tags.set(keyword, (tags.get(keyword) ?? 0) + 1);
    }
    // 只有带着管理会话（站长在 /admin 登录过）的人才允许发布与编辑说说。
    const session = await readSession(request);
    return ok({
      can_publish: Boolean(session),
      can_manage: Boolean(session),
      nonce: session?.nonce ?? '',
      tags: [...tags.entries()].map(([name, count]) => ({
        id: name,
        name,
        count,
        color: '#7aa2f7',
      })),
    });
  }

  if (op === 'detail') {
    const id = params.get('id') ?? '';
    const talk = talks.find((item) => item.id === id);
    if (!talk) return fail('这条说说已经不在这里了。', 404);
    const date = new Date(talk.createdAt);
    return ok({
      id: talk.id,
      content: talk.content,
      date_label: `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`,
      author: talk.memosName ?? '',
      location: talk.location ?? '',
      can_edit: false,
      version: talk.updatedAt ?? talk.createdAt,
      tags: (talk.keywords ?? []).map((name) => ({ name, color: '#7aa2f7' })),
      images: (talk.resources ?? []).map((resource) => ({
        url: resource.url ?? '',
        full: resource.url ?? '',
        alt: resource.name ?? '',
      })),
    });
  }

  const perPage = 18;
  const total = talks.length;
  const page = Math.max(1, num(params.get('page'), 1));
  const slice = talks.slice((page - 1) * perPage, page * perPage);

  return ok({
    html: renderTalkBoard(slice),
    total,
    more: page * perPage < total,
    page,
  });
}

async function actionTalkWrite(params: URLSearchParams, request: Request) {
  const op = params.get('op') ?? 'save';

  // 写说说属于站长专属能力：必须带着有效会话（/admin 登录后拿到的 Cookie）。
  const session = await readSession(request);
  if (!session) return fail('请先在 /admin 登录后再发布说说。', 403);
  const nonce = params.get('nonce') ?? '';
  if (nonce && nonce !== session.nonce) return fail('会话已过期，请刷新页面后重试。', 403);

  if (op === 'save') {
    const content = (params.get('content') ?? '').trim();
    if (!content) return fail('正文不能为空。');
    if (content.length > 4000) return fail('正文最多 4000 字。');

    const keywords = (params.get('tags') ?? '')
      .split(/[,，\n]+/)
      .map((tag) => tag.trim().replace(/^#/, ''))
      .filter(Boolean)
      .slice(0, 4);
    const location = (params.get('location') ?? '').trim().slice(0, 60);

    const id = `talk-${Date.now()}`;
    await updateStore((store) => {
      store.talks.unshift({
        id,
        content,
        visibility: 'PUBLIC',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        keywords,
        location: location || undefined,
        resources: [],
      });
    });

    return ok({ message: '说说已发布。', id });
  }

  if (op === 'delete') {
    const id = params.get('id') ?? '';
    await updateStore((store) => {
      store.talks = store.talks.filter((talk) => talk.id !== id);
    });
    return ok({ message: '这条说说已移入回收站。' });
  }

  return fail('未知的操作。');
}

async function actionComment(params: URLSearchParams) {
  const content = (params.get('comment') ?? '').trim();
  const author = (params.get('author') ?? '').trim();
  const email = (params.get('email') ?? '').trim();
  const url = (params.get('url') ?? '').trim();
  const postId = (params.get('post_id') ?? params.get('data-post-id') ?? 'guestbook');

  if (!content) return fail('留言内容不能为空。');
  if (!author) return fail('请填写昵称。');
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail('请填写有效的邮箱地址。');
  if (content.length > 4000) return fail('留言最多 4000 字。');

  // 与原 WordPress 一致：评论 ID 是数字，DOM 上是 comment-{数字}，
  // 前端按 `#comment-\d+` 匹配锚点、按 id.slice(8) 取出原始 ID 去自助编辑。
  const id = `${Date.now()}${Math.floor(Math.random() * 900) + 100}`;
  const token = Math.random().toString(36).slice(2) + Date.now().toString(36);

  await updateStore((store) => {
    store.comments.unshift({
      id,
      postId,
      author,
      email,
      content,
      date: new Date().toISOString(),
      approved: true,
      status: 'approved',
      link: url,
      source: 'local',
      token,
      tokenExpires: Date.now() + 60 * 1000,
    });
  });

  const anchor = postId === 'guestbook' ? `/guestbook/#comment-${id}` : `/essay/${postId}/#comment-${id}`;
  return ok({ message: '留言已发布，感谢你的分享。', url: anchor });
}

async function actionCommentSelfEdit(params: URLSearchParams) {
  const id = params.get('id') ?? '';
  const token = params.get('token') ?? '';
  const content = (params.get('content') ?? '').trim();

  const store = await getStore();
  const comment = store.comments.find((item) => item.id === id);
  if (!comment || comment.token !== token) return fail('这条留言的编辑凭证已失效。', 403);
  if ((comment.tokenExpires ?? 0) < Date.now()) return fail('编辑时间已过，请重新留言。', 403);
  if (!content) return fail('留言内容不能为空。');

  await updateStore((draft) => {
    const target = draft.comments.find((item) => item.id === id);
    if (target) {
      target.content = content;
      target.tokenExpires = Date.now() + 60 * 1000;
    }
  });

  return ok({ content });
}

async function actionCardColor(params: URLSearchParams) {
  // 卡片主色：原主题会分析封面图取色。这里退化为稳定的色相分布，
  // 至少保证 --feng-card-tone 有值，卡片不会出现空白背景。
  const postId = params.get('post_id') ?? '';
  const posts = await loadPosts();
  const post = posts.find((item) => item.slug === postId);
  if (!post) return fail('没有找到这篇文章。');

  let hash = 0;
  for (const char of post.slug) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const hue = hash % 360;
  const color = `hsl(${hue} 62% 62%)`;

  return ok({ color });
}

/**
 * 桌面宠物。
 *
 * 前端 pet.js 期望的响应形状：
 *   - data.state   快照（字段见 lib/pet.ts 的 PetSnapshot）
 *   - data.ai      是否接入 AI 陪伴（state 接口用）
 *   - data.message 互动反馈文案
 *   - data.reply / data.mode / data.note  聊天接口用
 */
async function actionPet(params: URLSearchParams) {
  const op = params.get('op') ?? 'state';

  if (op === 'state') {
    const store = await getStore();
    const postId = num(params.get('post_id'), 0);
    // 文章页会带上 post_id：先发一张阅读票据，停留够久后回来兑换成长值。
    const ticket = postId ? petIssueTicket(postId) : undefined;
    return ok({ state: petSnapshot(store.pet), ai: false, ticket });
  }

  if (op === 'feed' || op === 'pat') {
    const message = op === 'feed' ? '吃得好饱，谢谢你！' : '嘿嘿，挠得好舒服。';
    let recorded = false;
    await updateStore((draft) => {
      if (!petRecord(draft.pet, op)) return;
      recorded = true;
      draft.pet.xp += op === 'feed' ? 3 : 1;
      const today = new Date().toISOString().slice(0, 10);
      draft.pet.diary = [{ date: today, text: message }, ...draft.pet.diary].slice(0, 20);
    });
    if (!recorded) {
      return fail(op === 'feed' ? '它刚吃过，等半小时再来吧。' : '它正忙着呢，稍后再来。', 429);
    }
    const store = await getStore();
    return ok({ state: petSnapshot(store.pet), message, ai: false });
  }

  if (op === 'read') {
    const postId = num(params.get('post_id'), 0);
    const ticket = params.get('ticket') ?? '';
    if (!postId || petVerifyTicket(ticket, postId) === null) {
      return fail('这次陪伴没有记上，稍后再试。');
    }
    let recorded = false;
    await updateStore((draft) => {
      // 同一篇文章每天只计一次成长
      const today = new Date().toISOString().slice(0, 10);
      const seen = draft.pet.days[today]?.read ?? 0;
      if (seen > 0) return;
      if (!petRecord(draft.pet, 'read')) return;
      recorded = true;
      draft.pet.xp += 1;
    });
    if (!recorded) {
      return fail('这篇已经陪过一次了。');
    }
    const store = await getStore();
    return ok({ state: petSnapshot(store.pet), message: '谢谢你陪我读完了这一篇。' });
  }

  if (op === 'chat') {
    const question = (params.get('question') ?? '').trim().slice(0, 300);
    if (!question) return fail('想问点什么？');
    const store = await getStore();
    const snapshot = petSnapshot(store.pet);
    return ok({
      state: snapshot,
      reply: petReply(snapshot, question),
      mode: 'daily',
      note: '未配置 AI 服务，已使用本地日常问答。',
      ai: false,
    });
  }

  return fail('未知的操作。');
}

/** 日常问答：按真实状态回答，不编造。 */
function petReply(snapshot: PetSnapshot, question: string): string {
  if (/吃|饿|饱/.test(question)) {
    return `我现在饱食度 ${snapshot.satiety}%，${snapshot.satiety < 35 ? '有点饿了，等你投喂。' : '吃得刚刚好。'}`;
  }
  if (/长大|成长|等级|经验/.test(question)) {
    return `我是 ${snapshot.stage} · Lv.${snapshot.level}，成长值 ${snapshot.xp}${snapshot.next ? `，再攒 ${snapshot.next - snapshot.xp} 就升级。` : '，已经满级啦。'}`;
  }
  if (/几天|多久|陪/.test(question)) {
    return `我们已经相伴 ${snapshot.age} 天啦，连续 ${snapshot.streak} 天有互动。`;
  }
  if (/心情|状态/.test(question)) {
    return `我现在${snapshot.mood}，正陪着你读书。`;
  }
  return '我不太懂复杂的话题，但陪着你很开心。';
}


async function actionFriendGame(params: URLSearchParams) {
  const op = params.get('op') ?? 'list';
  const store = await getStore();

  if (op === 'list' || op === 'match_list') {
    return ok({ scores: store.gameScores.slice(-10).reverse() });
  }

  if (op === 'start' || op === 'match_start') {
    const size = num(params.get('size'), 16);
    const pairs = size / 2;
    const deck = Array.from({ length: pairs }, (_, index) => index)
      .flatMap((index) => [index, index])
      .sort(() => 0.5 - Math.random());
    return ok({ token: Math.random().toString(36).slice(2), deck, size });
  }

  if (op === 'score' || op === 'match_score') {
    const name = (params.get('name') ?? '访客').slice(0, 40);
    const moves = num(params.get('moves'), 0);
    const seconds = num(params.get('seconds'), 0);
    const points = num(params.get('points'), 0);
    await updateStore((draft) => {
      draft.gameScores.push({ name, moves, seconds, points, at: new Date().toISOString() });
      draft.gameScores = draft.gameScores.slice(-100);
    });
    return ok({ scores: store.gameScores.slice(-10).reverse(), score: { name, moves, seconds, points } });
  }

  if (op === 'player') {
    return ok({ name: '访客', avatar: '' });
  }

  return fail('未知的操作。');
}

async function actionFriendSendCode() {
  // 原主题通过邮件下发验证码；这里不外发邮件，仅返回统一提示。
  return fail('验证码发送暂未开放，请直接通过邮箱联系。', 501);
}

/**
 * 强制刷新订阅：跳过缓存，重新抓一遍各订阅源的 RSS，
 * 返回和 feng_feed_list 一样的结构，订阅页可以直接替换列表。
 */
async function actionFeedRefresh(params: URLSearchParams) {
  const sources = await loadSubscriptions(params.get('force') === '1');
  const rows = sources.flatMap((source) =>
    (source.latestItems ?? []).map((item) => ({
      title: item.title,
      url: item.url,
      date: item.date,
      summary: item.summary,
      source: source.name,
    })),
  );
  const perPage = 30;
  const page = Math.max(1, num(params.get('page'), 1));
  return ok({
    html: renderFeedRows(rows.slice((page - 1) * perPage, page * perPage)),
    total: rows.length,
    more: rows.length > perPage * page,
    page,
  });
}

async function actionAi() {
  return fail('AI 功能尚未配置。', 501);
}

/* ------------------------------------------------------------------ */
/* 调度                                                                */
/* ------------------------------------------------------------------ */

/**
 * 动作处理器。
 *
 * 多数动作是公开的（读内容、留言、宠物互动）；
 * 需要判断「是不是站长」的动作（比如发布说说）会用第二个参数里的请求，
 * 从管理会话 Cookie 判定权限。
 */
type ActionHandler = (params: URLSearchParams, request: Request) => Promise<Response>;

const ACTIONS: Record<string, ActionHandler> = {
  feng_activity: actionActivity,
  feng_hub: actionHub,
  feng_hero_activity: actionHeroActivity,
  feng_heatmap_day: actionHeatmapDay,
  feng_dashboard: actionDashboard,
  feng_random_article: actionRandomArticle,
  feng_github_stats: actionGithubStats,
  feng_greeting_identity: actionGreetingIdentity,
  feng_weather: actionWeather,
  feng_visitor_stats: actionVisitorStats,
  feng_feed_count: actionFeedCount,
  feng_feed_list: actionFeedList,
  feng_talk_read: actionTalkRead,
  feng_talk_write: actionTalkWrite,
  feng_comment: actionComment,
  feng_comment_self_edit: actionCommentSelfEdit,
  feng_card_color: actionCardColor,
  feng_pet: actionPet,
  feng_friend_game: actionFriendGame,
  feng_friend_send_code: actionFriendSendCode,
  feng_feed_refresh: actionFeedRefresh,
  feng_ai: actionAi,
};

export const GET: APIRoute = async ({ request }) => {
  const params = await readParams(request);
  const action = params.get('action') ?? '';
  const handler = ACTIONS[action];
  if (!handler) return fail(`未知的动作：${action}`, 404);
  try {
    return await handler(params, request);
  } catch (error) {
    console.error(`[feng] ${action} 处理失败`, error);
    return fail('服务器开小差了，请稍后再试。', 500);
  }
};

export const POST: APIRoute = async ({ request }) => {
  const params = await readParams(request);
  const action = params.get('action') ?? '';
  const handler = ACTIONS[action];
  if (!handler) return fail(`未知的动作：${action}`, 404);
  try {
    return await handler(params, request);
  } catch (error) {
    console.error(`[feng] ${action} 处理失败`, error);
    return fail('服务器开小差了，请稍后再试。', 500);
  }
};
