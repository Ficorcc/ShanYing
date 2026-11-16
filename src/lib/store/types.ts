/**
 * 运行期数据的形状定义。
 *
 * 站点内容（文章、说说、友链、订阅源）来自本地文件与 CMS；
 * 评论、浏览量、访客统计、宠物状态、游戏成绩这类「运行期数据」
 * 需要一个可写的地方。
 *
 * 这份文件只放类型和默认值，不含任何平台相关的 API，
 * 好让 Node（文件）与 Cloudflare（KV）两套后端共用同一份契约。
 */

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

export const EMPTY_STORE: StoreShape = {
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

/**
 * 把磁盘 / KV 里读到的旧数据补齐成完整结构。
 *
 * 宠物结构在迭代中加过字段，旧的存档缺字段是常态，
 * 这里做一次深合并而不是直接覆盖，避免老存档读出来是一堆 undefined。
 */
export function mergeStore(parsed: Partial<StoreShape> | null | undefined): StoreShape {
  const merged = { ...structuredClone(EMPTY_STORE), ...(parsed ?? {}) } as StoreShape;
  merged.comments = [...(parsed?.comments ?? [])];
  merged.talks = [...(parsed?.talks ?? [])];
  merged.gameScores = [...(parsed?.gameScores ?? [])];
  merged.friendApplications = [...(parsed?.friendApplications ?? [])];
  merged.settings = { ...EMPTY_STORE.settings, ...(parsed?.settings ?? {}) };
  merged.views = { ...(parsed?.views ?? {}) };
  merged.visitors = { ...(parsed?.visitors ?? {}) };
  merged.pet = { ...EMPTY_STORE.pet, ...(parsed?.pet ?? {}) };
  merged.pet.days = { ...(parsed?.pet?.days ?? {}) };
  merged.pet.totals = { ...(parsed?.pet?.totals ?? {}) };
  merged.pet.diary = [...(parsed?.pet?.diary ?? [])];
  return merged;
}
