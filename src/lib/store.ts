/**
 * 运行时数据存储。
 *
 * 站点内容（文章、说说、友链、订阅源）来自本地文件与 CMS；
 * 而评论、浏览量、访客统计、宠物状态、游戏成绩这类「运行期数据」
 * 需要一个可写的地方。
 *
 * 这里用项目根目录下的 var/store.json 承载，不写回 src/，
 * 避免运行时写入触发内容集合重建；文件不存在时按空数据起步。
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * 定位项目根目录。
 *
 * 不能按源码文件位置往上数层级 —— 开发时 store.ts 在 src/lib/，
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

const projectRoot = findProjectRoot();
const storePath = join(projectRoot, 'var', 'store.json');

export interface StoredComment {
  id: string;
  postId: string;
  author: string;
  email: string;
  content: string;
  date: string;
  approved: boolean;
  status?: 'approved' | 'waiting' | 'spam';
  link?: string;
  source?: 'local' | 'waline';
  reply?: string;
  /** 自助编辑票据 */
  token?: string;
  tokenExpires?: number;
}

export interface StoredTalk {
  id: string;
  memosName?: string;
  content: string;
  visibility: 'PUBLIC' | 'PROTECTED' | 'PRIVATE';
  createdAt: string;
  updatedAt?: string;
  pinned?: boolean;
  keywords?: string[];
  location?: string;
  resources?: { name?: string; filename?: string; type?: string; url?: string }[];
}

export interface SiteSettings {
  title: string;
  subtitle: string;
  description: string;
  author: string;
  email: string;
  icpNumber: string;
  policeNumber: string;
  github: string;
  x: string;
}

export interface StoreShape {
  comments: StoredComment[];
  talks: StoredTalk[];
  /** 站点信息（管理页可改） */
  settings: SiteSettings;
  /** 文章 slug → 浏览量 */
  views: Record<string, number>;
  /** 全站浏览量 */
  pageViews: number;
  /** 访客 uuid → 最后活跃时间戳 */
  visitors: Record<string, number>;
  /** 宠物状态（对应原主题 feng_pet_state 表） */
  pet: {
    level: number;
    xp: number;
    satiety: number;
    mood: string;
    streak: number;
    diary: { date: string; text: string }[];
    /** 出生时间戳，用于计算陪伴天数 */
    born: number;
    /** 最近一次投喂时间戳 */
    lastFeed: number;
    /** 最近一次互动的日期，用于连续天数 */
    lastVisitDay: string;
    /** 日期 → 当日各互动计数 */
    days: Record<string, { feed?: number; pat?: number; read?: number; comment?: number }>;
    /** 各类互动累计次数 */
    totals: Record<string, number>;
  };
  /** 游戏成绩 */
  gameScores: { name: string; avatar?: string; moves: number; seconds: number; points?: number; at: string }[];
  /** 友链申请 */
  friendApplications: {
    id: string;
    name: string;
    url: string;
    description: string;
    email: string;
    at: string;
  }[];
}

const EMPTY: StoreShape = {
  comments: [],
  talks: [],
  settings: {
    title: '',
    subtitle: '',
    description: '',
    author: '',
    email: '',
    icpNumber: '',
    policeNumber: '',
    github: '',
    x: '',
  },
  views: {},
  pageViews: 0,
  visitors: {},
  pet: {
    level: 1,
    xp: 0,
    satiety: 80,
    mood: '平静',
    streak: 0,
    diary: [],
    born: 0,
    lastFeed: 0,
    lastVisitDay: '',
    days: {},
    totals: {},
  },
  gameScores: [],
  friendApplications: [],
};

let cache: StoreShape | null = null;
let writing: Promise<void> = Promise.resolve();

async function load(): Promise<StoreShape> {
  if (cache) return cache;
  if (!existsSync(storePath)) {
    cache = structuredClone(EMPTY);
    return cache;
  }
  try {
    const raw = await readFile(storePath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<StoreShape>;
    const merged = { ...structuredClone(EMPTY), ...parsed } as StoreShape;
    // 宠物结构在迭代中加过字段，这里做一次深合并，避免旧文件缺字段。
    merged.pet = { ...structuredClone(EMPTY.pet), ...(parsed.pet ?? {}) };
    merged.pet.days = { ...(parsed.pet?.days ?? {}) };
    merged.pet.totals = { ...(parsed.pet?.totals ?? {}) };
    merged.pet.diary = [...(parsed.pet?.diary ?? [])];
    cache = merged;
  } catch {
    cache = structuredClone(EMPTY);
  }
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
  writing = writing.then(async () => {
    await mkdir(dirname(storePath), { recursive: true });
    await writeFile(storePath, `${JSON.stringify(cache, null, 2)}\n`, 'utf8');
  });
  await writing;
  return result;
}

/** 仅用于测试：清空内存缓存。 */
export function resetStoreCache() {
  cache = null;
}
