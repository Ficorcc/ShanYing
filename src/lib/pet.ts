/**
 * 桌面宠物逻辑。
 *
 * 移植自原 WordPress 主题 inc/inc-pet.php 的 feng_pet_snapshot() /
 * feng_pet_growth_form() / feng_pet_diary() / feng_pet_quota()，
 * 规则（阶段阈值、体型比例、饱食度衰减、投喂配额）与原主题一致，
 * 只是把 MySQL 换成了 var/store.json。
 */
import type { StoreShape } from './store';

type PetState = StoreShape['pet'];

/** 成长阶段：[成长值门槛, 阶段名]，与原主题一致。 */
const STAGES: [number, string][] = [
  [0, '初遇'],
  [40, '熟悉'],
  [140, '亲近'],
  [360, '默契'],
  [800, '伙伴'],
];

/** 各阶段的体型形态：名称与缩放比例。 */
const FORMS: { name: string; scale: number }[] = [
  { name: '幼年', scale: 0.72 },
  { name: '成长中', scale: 0.8 },
  { name: '少年', scale: 0.88 },
  { name: '接近成年', scale: 0.95 },
  { name: '成年', scale: 1 },
];

export interface PetSnapshot {
  xp: number;
  stage: string;
  level: number;
  form: { name: string; scale: number };
  /** 下一阶段所需成长值，已满级为 null */
  next: number | null;
  /** 当前阶段内的进度百分比 */
  progress: number;
  satiety: number;
  mood: string;
  sleeping: boolean;
  streak: number;
  /** 陪伴天数 */
  age: number;
  /** 最近 7 天的日记 */
  diary: string[];
  today: { feed?: number; pat?: number; read?: number; comment?: number };
  totals: Record<string, number>;
  date: string;
  hour: number;
}

const DAY = 86400000;

function dateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** 本地日期按日偏移。 */
function shiftDay(date: Date, offset: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + offset);
  return next;
}

/**
 * 生成宠物快照。字段与前端 pet.js 的 render() 期望严格一致。
 */
export function petSnapshot(state: PetState, now = new Date()): PetSnapshot {
  const born = state.born || now.getTime();
  const lastFeed = state.lastFeed || now.getTime();

  // 饱食度随时间衰减，每小时掉 3 点，最低 15
  const hoursSinceFeed = (now.getTime() - lastFeed) / 3600000;
  const satiety = Math.max(15, Math.min(100, Math.round(85 - hoursSinceFeed * 3)));

  let levelIndex = 0;
  for (let i = 0; i < STAGES.length; i += 1) {
    if (state.xp >= STAGES[i][0]) levelIndex = i;
  }
  const level = levelIndex + 1;
  const current = STAGES[levelIndex];
  const next = STAGES[levelIndex + 1]?.[0] ?? null;
  const progress = next
    ? Math.round(((state.xp - current[0]) / (next - current[0])) * 100)
    : 100;

  const hour = now.getHours();
  const asleep = hour >= 23 || hour < 7;
  const today = dateKey(now);
  const todayCounts = state.days[today] ?? {};

  const mood = asleep
    ? '困困的'
    : satiety < 35
      ? '有点饿'
      : todayCounts.feed
        ? '心满意足'
        : '好奇地张望';

  // 连续互动天数：昨天没有互动就断签
  const yesterday = dateKey(shiftDay(now, -1));
  const streak = state.lastVisitDay < yesterday ? 0 : Math.max(1, state.streak);

  // 最近 7 天日记
  const diary: string[] = [];
  for (let offset = 0; offset < 7; offset += 1) {
    const day = dateKey(shiftDay(now, -offset));
    if (day < dateKey(new Date(born))) break;
    diary.push(petDiary(day, state.days[day] ?? {}));
  }

  const age = Math.max(1, Math.floor((now.getTime() - born) / DAY) + 1);

  return {
    xp: state.xp,
    stage: current[1],
    level,
    form: FORMS[Math.min(FORMS.length - 1, levelIndex)],
    next,
    progress,
    satiety,
    mood,
    sleeping: asleep,
    streak,
    age,
    diary,
    today: todayCounts,
    totals: state.totals ?? {},
    date: today,
    hour,
  };
}

/** 一天的互动摘要。原主题 feng_pet_diary() 只记录次数，不记访客信息。 */
export function petDiary(day: string, counts: { feed?: number; pat?: number; read?: number; comment?: number }): string {
  const parts: string[] = [];
  if (counts.feed) parts.push(`投喂 ${counts.feed} 次`);
  if (counts.pat) parts.push(`被摸了摸 ${counts.pat} 次`);
  if (counts.read) parts.push(`被读了 ${counts.read} 篇`);
  if (counts.comment) parts.push(`收到 ${counts.comment} 条新留言`);
  if (!parts.length) return `${day}：安静的一天。`;
  return `${day}：${parts.join('，')}。`;
}

/** 互动计数的上限（与原主题一致）。 */
export const PET_QUOTA = {
  /** 每天最多投喂次数 */
  feedPerDay: 3,
  /** 投喂冷却（毫秒） */
  feedCooldown: 30 * 60 * 1000,
} as const;

/**
 * 配额检查。返回 true 表示可以记这次互动。
 * 投喂：每天 3 次，且间隔半小时；其他互动不限量。
 */
export function petQuotaAllowed(
  state: PetState,
  kind: 'feed' | 'pat' | 'read' | 'comment',
  now = new Date(),
): boolean {
  if (kind !== 'feed') return true;
  const today = dateKey(now);
  if ((state.days[today]?.feed ?? 0) >= PET_QUOTA.feedPerDay) return false;
  if (state.lastFeed && now.getTime() - state.lastFeed < PET_QUOTA.feedCooldown) return false;
  return true;
}

/** 记录一次互动。返回是否记成功。 */
export function petRecord(
  state: PetState,
  kind: 'feed' | 'pat' | 'read' | 'comment',
  now = new Date(),
): boolean {
  if (!petQuotaAllowed(state, kind, now)) return false;
  if (!state.born) state.born = now.getTime();
  const today = dateKey(now);
  const bucket = (state.days[today] ??= {});
  bucket[kind] = (bucket[kind] ?? 0) + 1;
  state.totals[kind] = (state.totals[kind] ?? 0) + 1;
  if (kind === 'feed') state.lastFeed = now.getTime();
  if (state.lastVisitDay !== today) {
    const yesterday = dateKey(shiftDay(now, -1));
    state.streak = state.lastVisitDay === yesterday ? state.streak + 1 : 1;
    state.lastVisitDay = today;
  }
  return true;
}

/**
 * 阅读成长票据。
 *
 * 前端在文章页停留足够久后，用 state 接口拿到的票据来兑换成长值。
 * 这里用「文章 ID + 签发时间」做一次性令牌，两分钟内有效。
 */
export function petIssueTicket(postId: number): string {
  return `${postId}.${Date.now()}.${Math.random().toString(36).slice(2, 10)}`;
}

/** 校验票据。返回文章 ID，无效返回 null。 */
export function petVerifyTicket(ticket: string, postId: number): number | null {
  const parts = ticket.split('.');
  if (parts.length < 2) return null;
  const id = Number(parts[0]);
  const issuedAt = Number(parts[1]);
  if (!Number.isFinite(id) || id !== postId) return null;
  if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > 2 * 60 * 1000) return null;
  return id;
}
