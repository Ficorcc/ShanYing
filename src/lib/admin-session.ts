/**
 * 管理会话：HMAC 签名 Cookie。
 *
 * 用途：
 *   1. /admin 用管理口令登录一次，拿到一个签名 Cookie；
 *   2. 前台说说页凭这个 Cookie 判断「当前是站长」，从而允许发布说说。
 *
 * 设计要点：
 *   - Cookie 里只放「过期时间 + 签名」，不放口令本身，也不放任何可读信息；
 *   - 签名用 HMAC-SHA256（口令为密钥），服务端才算得出来；
 *   - HttpOnly + SameSite=Lax：脚本读不到，跨站表单也带不上，
 *     所以 CSRF 打不到这个会话上；
 *   - 口令一旦改动，所有旧会话立刻失效（签名对不上）。
 *
 * 管理口令来自平台后端（Node 读环境变量，Cloudflare 读 Worker secret），
 * 没配置口令时整个管理能力是关闭的（fail closed），不做「开发模式全开」。
 */
import { adminSecret } from '@shanying/admin-secret';

/** 会话 Cookie 名。 */
export const SESSION_COOKIE = 'shanying_admin';

/** 会话有效期（秒）：7 天。 */
export const SESSION_TTL = 60 * 60 * 24 * 7;

/** 是否配置了管理口令。 */
export function secretConfigured(): boolean {
  return adminSecret().length > 0;
}

const encoder = new TextEncoder();

/** HMAC-SHA256 签名，输出小写十六进制。 */
async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** 定长比较，避免按字符提前返回。 */
function equal(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** 口令是否正确。 */
export function tokenMatches(candidate: string): boolean {
  const secret = adminSecret();
  if (!secret || !candidate) return false;
  return equal(candidate, secret);
}

/** 生成会话令牌：`过期时间.签名`。 */
export async function createSession(): Promise<string> {
  const secret = adminSecret();
  const expires = Math.floor(Date.now() / 1000) + SESSION_TTL;
  const signature = await hmac(secret, String(expires));
  return `${expires}.${signature}`;
}

/** 会话信息：过期时间 + 写操作用的 nonce。 */
export interface AdminSession {
  expires: number;
  nonce: string;
}

/** 从请求里读会话；没有口令、没 Cookie、过期或签名不合法都返回 null。 */
export async function readSession(request: Request): Promise<AdminSession | null> {
  const secret = adminSecret();
  if (!secret) return null;

  const cookie = readCookie(request.headers.get('cookie'))[SESSION_COOKIE];
  if (!cookie) return null;

  const [expires, signature] = cookie.split('.');
  const expiresAt = Number(expires);
  if (!expiresAt || !signature) return null;
  if (expiresAt * 1000 <= Date.now()) return null;

  const expected = await hmac(secret, String(expiresAt));
  if (!equal(signature, expected)) return null;

  return { expires: expiresAt, nonce: (await hmac(secret, `nonce:${expiresAt}`)).slice(0, 16) };
}

/** 当前请求是不是站长。 */
export async function isAdmin(request: Request): Promise<boolean> {
  return (await readSession(request)) !== null;
}

/** 写入会话 Cookie。 */
export function sessionCookie(token: string, secure: boolean): string {
  const flags = [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${SESSION_TTL}`,
  ];
  if (secure) flags.push('Secure');
  return flags.join('; ');
}

/** 清除会话 Cookie。 */
export function clearSessionCookie(secure: boolean): string {
  const flags = [`${SESSION_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (secure) flags.push('Secure');
  return flags.join('; ');
}

/** 解析 Cookie 串。 */
function readCookie(header: string | null): Record<string, string> {
  const jar: Record<string, string> = {};
  if (!header) return jar;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const name = part.slice(0, index).trim();
    if (!name) continue;
    jar[name] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return jar;
}
