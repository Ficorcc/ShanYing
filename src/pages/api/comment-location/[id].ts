/**
 * 评论地理位置查询。
 *
 * 对应原 WordPress 的 REST 路由 `feng/v1/comment-location/{id}`。
 * 注意：前端直接读取响应体的 `label` / `code` 两个字段，
 * 这里刻意不套 `{success,data}` 信封。
 */
export const prerender = false;

import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ request }) => {
  const ip =
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-real-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();

  if (!ip) {
    return new Response(JSON.stringify({ label: '所在地未知', code: '' }), {
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }

  try {
    const response = await fetch(`https://api.cnip.io/geoip/${ip}`, {
      signal: AbortSignal.timeout(4000),
    });
    const data = (await response.json()) as {
      country?: string;
      country_code?: string;
      city?: string;
    };
    const label = [data.city, data.country].filter(Boolean).join(' · ') || '所在地未知';
    return new Response(
      JSON.stringify({ label, code: (data.country_code ?? '').toLowerCase() }),
      { headers: { 'content-type': 'application/json; charset=utf-8' } },
    );
  } catch {
    return new Response(JSON.stringify({ label: '所在地未知', code: '' }), {
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }
};
