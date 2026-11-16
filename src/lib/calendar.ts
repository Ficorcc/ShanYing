/**
 * 发布热力图日历。移植自 functions.php 的 feng_activity_calendar()。
 *
 * 结构：.feng-calendar-activity > .feng-activity-scroll > .feng-activity-grid
 * 每格 .feng-activity-day[data-level]，level 由当日发布量取对数得到（0–4）。
 */
import { esc } from './render';

export interface CalendarOptions {
  /** 每天的发布量，键为 YYYY-MM-DD */
  counts: Record<string, number>;
  /** 统计范围天数，默认一年 */
  days?: number;
  /** 行数（1–7），7 表示按周对齐 */
  rows?: number;
  /** 标题文案 */
  title?: string;
  /** 统计口径文案 */
  unit?: string;
  hideHeading?: boolean;
  hideFooter?: boolean;
  /** 固定年份；给定后忽略 days */
  year?: number;
}

const pad = (value: number) => String(value).padStart(2, '0');
const iso = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export function activityCalendar(options: CalendarOptions): string {
  const {
    counts,
    days = 365,
    rows = 7,
    title = '文章更新记录',
    unit = '篇文章',
    hideHeading = false,
    hideFooter = false,
    year = 0,
  } = options;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const end = year ? new Date(year, 11, 31) : today;
  const start = year ? new Date(year, 0, 1) : new Date(today.getTime() - (Math.max(1, Math.min(366, days)) - 1) * 86400000);
  start.setHours(0, 0, 0, 0);

  const gridRows = Math.max(1, Math.min(7, rows));
  // 7 行时向前补齐到周一，让每一列正好是一周
  const gridStart = new Date(start);
  if (gridRows === 7) gridStart.setDate(gridStart.getDate() - ((gridStart.getDay() + 6) % 7));

  const span = Math.round((end.getTime() - gridStart.getTime()) / 86400000) + 1;
  const weeks = Math.max(1, Math.ceil(span / gridRows));

  let total = 0;
  for (const value of Object.values(counts)) total += value;

  const cells: string[] = [];
  for (let i = 0; i < weeks * gridRows; i++) {
    const date = new Date(gridStart);
    date.setDate(date.getDate() + i);
    const day = iso(date);
    const outside = date < start || date > end;
    const n = counts[day] ?? 0;
    const level = n ? Math.min(4, Math.ceil(Math.log2(n + 1))) : 0;
    const label = `${day} · ${n} ${unit}最后更新`;
    cells.push(
      outside
        ? `<span class="feng-activity-day" data-level="${level}" aria-hidden="true" style="visibility:hidden"></span>`
        : `<span class="feng-activity-day" data-level="${level}" tabindex="0" aria-label="${esc(label)}" data-tip="${esc(label)}"></span>`,
    );
  }

  return `<section class="feng-calendar-activity" aria-label="${esc(title)}">
${hideHeading ? '' : `<header><strong>${esc(title)}</strong><span>${year ? `${year} 年` : '近一年'} · ${total} ${esc(unit)}</span></header>`}
<div class="feng-activity-scroll"><div class="feng-activity-grid" style="--activity-weeks:${weeks}">${cells.join('')}</div></div>
${
  hideFooter
    ? ''
    : `<footer><small>${esc(
        `${start.getFullYear()}.${pad(start.getMonth() + 1)}.${pad(start.getDate())} — ${end.getFullYear()}.${pad(end.getMonth() + 1)}.${pad(end.getDate())}`,
      )} · 每篇文章按最后更新时间计一次</small><span class="feng-activity-legend">少 ${[0, 1, 2, 3, 4]
        .map((level) => `<i data-level="${level}"></i>`)
        .join('')} 多</span></footer>`
}
</section>`;
}
