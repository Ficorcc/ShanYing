/**
 * 管理接口。
 *
 * 对应原 WordPress 主题的后台设置面板（functions.php + inc/inc-settings.php），
 * 移植成站点内的 /admin 页面配套 API。
 *
 * 安全：设置环境变量 `SHANYING_ADMIN_TOKEN` 后，所有写操作都需要带上
 * `token` 参数；未设置时视为本地开发模式，不做校验。
 */
export const prerender = false;

import type { APIRoute } from 'astro';
import { getStore, updateStore } from '../../lib/store';
import { getPublishedMeta, activeLinks, publicMemos } from '../../lib/content';
import { comments as seedComments, feed, links } from '../../lib/data';

function authorized(request: Request, params: URLSearchParams): boolean {
  const expected = process.env.SHYANYING_ADMIN_TOKEN;
  if (!expected) return true;
  const provided = params.get('token') ?? request.headers.get('x-admin-token') ?? '';
  return provided === expected;
}

async function readParams(request: Request): Promise<URLSearchParams> {
  const url = new URL(request.url);
  const params = new URLSearchParams(url.search);
  if (request.method === 'POST') {
    try {
      const type = request.headers.get('content-type') ?? '';
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
      /* 忽略解析失败 */
    }
  }
  return params;
}

const ok = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data }), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

const fail = (message: string, status = 400) =>
  new Response(JSON.stringify({ success: false, data: { message } }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

export const GET: APIRoute = async ({ request }) => {
  const params = await readParams(request);
  if (!authorized(request, params)) return fail('管理令牌不正确。', 401);

  const store = await getStore();
  const posts = await getPublishedMeta();
  const talks = publicMemos();
  const comments = [...seedComments, ...store.comments];
  const friends = activeLinks();

  return ok({
    overview: {
      posts: posts.length,
      talks: talks.length + store.talks.length,
      comments: comments.length,
      friends: friends.length,
      subscriptions: feed.subscriptions?.length ?? 0,
      pageViews: store.pageViews,
      words: posts.reduce((sum, post) => sum + post.body.length, 0),
    },
    talks: [...store.talks].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    comments: comments
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((comment) => ({
        id: comment.id,
        postId: comment.postId,
        author: comment.author,
        content: comment.content,
        date: comment.date,
        approved: comment.approved,
      })),
    friends,
    settings: store.settings,
  });
};

export const POST: APIRoute = async ({ request }) => {
  const params = await readParams(request);
  if (!authorized(request, params)) return fail('管理令牌不正确。', 401);

  const action = params.get('action') ?? '';

  if (action === 'talk.save') {
    const content = (params.get('content') ?? '').trim();
    if (!content) return fail('说说内容不能为空。');
    const id = params.get('id') ?? `talk-${Date.now()}`;
    const keywords = (params.get('tags') ?? '')
      .split(/[,，\n]+/)
      .map((tag) => tag.trim().replace(/^#/, ''))
      .filter(Boolean)
      .slice(0, 4);

    await updateStore((store) => {
      const existing = store.talks.find((talk) => talk.id === id);
      if (existing) {
        existing.content = content;
        existing.keywords = keywords;
        existing.updatedAt = new Date().toISOString();
      } else {
        store.talks.unshift({
          id,
          content,
          visibility: 'PUBLIC',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          keywords,
          resources: [],
        });
      }
    });
    return ok({ message: '说说已保存。', id });
  }

  if (action === 'talk.delete') {
    const id = params.get('id') ?? '';
    await updateStore((store) => {
      store.talks = store.talks.filter((talk) => talk.id !== id);
    });
    return ok({ message: '说说已删除。' });
  }

  if (action === 'comment.approve') {
    const id = params.get('id') ?? '';
    const approved = params.get('approved') === '1';
    await updateStore((store) => {
      const comment = store.comments.find((item) => item.id === id);
      if (comment) {
        comment.approved = approved;
        comment.status = approved ? 'approved' : 'waiting';
      }
    });
    return ok({ message: approved ? '评论已通过。' : '评论已转为待审。' });
  }

  if (action === 'comment.delete') {
    const id = params.get('id') ?? '';
    await updateStore((store) => {
      store.comments = store.comments.filter((comment) => comment.id !== id);
    });
    return ok({ message: '评论已删除。' });
  }

  if (action === 'settings.save') {
    const fields = [
      'title',
      'subtitle',
      'description',
      'author',
      'email',
      'icpNumber',
      'policeNumber',
      'github',
      'x',
    ] as const;
    await updateStore((store) => {
      for (const field of fields) {
        const value = params.get(field);
        if (value !== null) store.settings[field] = value.slice(0, 300);
      }
    });
    return ok({ message: '站点信息已保存（重启后生效）。' });
  }

  return fail(`未知的管理动作：${action}`, 404);
};
