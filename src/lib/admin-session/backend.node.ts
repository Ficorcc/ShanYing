/**
 * Node 平台：管理口令放在进程环境变量里。
 *
 * 本地开发时写进项目根目录的 .env（已被 .gitignore 忽略，不会进仓库）。
 */
export function adminSecret(): string {
  return process.env.SHANYING_ADMIN_TOKEN ?? '';
}
