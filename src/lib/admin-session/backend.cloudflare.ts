/**
 * Cloudflare 平台：管理口令放在 Worker 的 secret 里。
 *
 * 用 `npx wrangler secret put SHANYING_ADMIN_TOKEN` 写入，
 * 密钥不会进仓库，也不会出现在构建产物里。
 */
import { env } from 'cloudflare:workers';

export function adminSecret(): string {
  return (env as unknown as Record<string, string | undefined>).SHANYING_ADMIN_TOKEN ?? '';
}
