/**
 * Cloudflare 平台的存储后端：把运行期数据写进 Workers KV。
 *
 * Cloudflare Workers 没有可写文件系统，var/store.json 那套在 Worker 里落不了盘，
 * 所以这里改用 KV namespace（绑定名 SHANYING_STORE）承载同一份 JSON。
 *
 * KV 同一个 key 的写入频率上限是每秒一次，宠物互动、评论这类高频写入
 * 直接打过去会被限流拒绝，所以这里做了节流与合并：
 *   - 相邻两次写入至少间隔 1 秒；
 *   - 等待期间到来的新写入会覆盖待写快照，一批突发只落一次盘。
 *
 * 没配 KV 绑定时不报错：读按空数据走，写静默丢弃，
 * 站点照常可用，只是留言 / 说说 / 宠物进度这类运行期数据不落盘。
 */
import { env } from 'cloudflare:workers';

import type { StoreShape } from './types';

/** KV 绑定名。 */
const BINDING = 'SHANYING_STORE';
/** 存档 key。 */
const KEY = 'shanying:store';
/** 两次写入之间的最小间隔（毫秒），对齐 KV 每秒一次的写入上限。 */
const WRITE_INTERVAL = 1000;

let warnedMissing = false;

function namespace(): KVNamespace | null {
  const binding = (env as unknown as Record<string, unknown>)[BINDING];
  if (!binding) {
    if (!warnedMissing) {
      warnedMissing = true;
      console.warn(`[store] 未配置 KV 绑定 ${BINDING}，运行期数据不会持久化（留言 / 说说 / 宠物进度）`);
    }
    return null;
  }
  return binding as KVNamespace;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 读取存档；没有绑定、key 不存在或内容损坏时返回 null。 */
export async function readStore(): Promise<Partial<StoreShape> | null> {
  const kv = namespace();
  if (!kv) return null;
  try {
    const raw = await kv.get(KEY, 'json');
    return (raw as Partial<StoreShape> | null) ?? null;
  } catch {
    return null;
  }
}

let pending: StoreShape | undefined;
let draining: Promise<void> | null = null;
let lastWriteAt = 0;

/** 落盘（节流 + 合并）。 */
export async function writeStore(store: StoreShape): Promise<void> {
  const kv = namespace();
  if (!kv) return;

  pending = store;
  if (!draining) {
    draining = (async () => {
      try {
        while (pending) {
          const wait = Math.max(0, WRITE_INTERVAL - (Date.now() - lastWriteAt));
          if (wait > 0) await sleep(wait);
          // 等待期间到来的新写入会覆盖这一份快照，突发只落一次盘
          const snapshot = pending;
          pending = undefined;
          if (!snapshot) break;
          await kv.put(KEY, JSON.stringify(snapshot));
          lastWriteAt = Date.now();
        }
      } catch (error) {
        console.error('[store] KV 写入失败', error);
      } finally {
        draining = null;
      }
    })();
  }
  await draining;
}
