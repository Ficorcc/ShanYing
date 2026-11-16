/**
 * 运行时数据存储。
 *
 * 站点内容（文章、说说、友链、订阅源）来自本地文件与 CMS；
 * 而评论、浏览量、访客统计、宠物状态、游戏成绩这类「运行期数据」
 * 需要一个可写的地方。
 *
 * 实际落盘交给平台相关的后端（`@shanying/store-backend`）：
 *   - Node 平台  → var/store.json（本地开发 / Node 部署）
 *   - Cloudflare → Workers KV namespace（绑定名 SHANYING_STORE）
 * 两个后端实现同一组读写函数，调用方无感知。
 */
import {
  mergeStore,
  type SiteSettings,
  type StoreShape,
  type StoredComment,
  type StoredTalk,
} from './store/types';
import { readStore, writeStore } from '@shanying/store-backend';

export type { SiteSettings, StoreShape, StoredComment, StoredTalk };
export { EMPTY_STORE } from './store/types';

let cache: StoreShape | null = null;

async function load(): Promise<StoreShape> {
  if (cache) return cache;
  // 平台后端读不到内容时（首次运行、存档损坏）按空数据起步
  cache = mergeStore(await readStore());
  return cache;
}

/** 读取当前存储。 */
export async function getStore(): Promise<StoreShape> {
  return load();
}

/** 修改并落盘。mutator 返回值会覆盖对应字段。 */
export async function updateStore<T>(
  mutator: (store: StoreShape) => T | Promise<T>,
): Promise<T> {
  const store = await load();
  const result = await mutator(store);
  await writeStore(store);
  return result;
}

/** 仅用于测试：清空内存缓存。 */
export function resetStoreCache() {
  cache = null;
}
