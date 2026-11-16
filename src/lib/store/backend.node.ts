/**
 * Node 平台的存储后端：把运行期数据写进项目根目录的 var/store.json。
 *
 * 不写回 src/，避免运行时写入触发内容集合重建；
 * 文件不存在时按空数据起步。
 *
 * 这个模块只会在 Node 平台（本地开发 / Node 部署）被打进产物；
 * Cloudflare 平台走 backend.cloudflare.ts。
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { StoreShape } from './types';

/**
 * 定位项目根目录。
 *
 * 不能按源码文件位置往上数层级 —— 开发时本文件在 src/lib/store/，
 * 打包后它被塞进 dist/server/ 的 chunk 里，层级完全不同，
 * 那样算出来的是 dist/，运行时数据就会写进构建产物（重新构建即丢失）。
 *
 * 所以改成「向上找 astro.config.mjs」：
 *   1. 环境变量 SHANYING_STORE_DIR 优先（部署时可直接指到持久化目录）；
 *   2. 从当前工作目录向上找；
 *   3. 从本文件所在目录向上找（覆盖用绝对路径启动服务的场景）；
 *   4. 兜底用当前工作目录。
 */
function findProjectRoot(): string {
  const explicit = process.env.SHANYING_STORE_DIR;
  if (explicit) return explicit;

  const hasRoot = (dir: string) => existsSync(join(dir, 'astro.config.mjs'));

  const walkUp = (start: string): string | null => {
    let current = start;
    // 最多向上 8 层，避免在异常路径上无限循环
    for (let depth = 0; depth < 8; depth += 1) {
      if (hasRoot(current)) return current;
      const parent = dirname(current);
      if (parent === current) break;
      current = parent;
    }
    return null;
  };

  const fromCwd = walkUp(process.cwd());
  if (fromCwd) return fromCwd;

  const fromModule = walkUp(dirname(fileURLToPath(import.meta.url)));
  if (fromModule) return fromModule;

  return process.cwd();
}

const storePath = join(findProjectRoot(), 'var', 'store.json');

/** 读取存档；文件不存在或损坏时返回 null，由上层套默认值。 */
export async function readStore(): Promise<Partial<StoreShape> | null> {
  if (!existsSync(storePath)) return null;
  try {
    const raw = await readFile(storePath, 'utf8');
    return JSON.parse(raw) as Partial<StoreShape>;
  } catch {
    return null;
  }
}

/** 落盘。 */
export async function writeStore(store: StoreShape): Promise<void> {
  await mkdir(dirname(storePath), { recursive: true });
  await writeFile(storePath, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
}
