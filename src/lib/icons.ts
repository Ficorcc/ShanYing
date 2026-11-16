/**
 * 山映主题图标库。
 *
 * 移植自 WordPress 主题的 `feng_icon()`（inc/inc-media.php）：统一 24px 网格、
 * 1.6px 圆头描边，不依赖图标字体。少数图标仍走 Font Awesome（品牌类）。
 *
 * 渲染方式为「返回 HTML 字符串」，与原主题保持一致，方便在 Astro 组件里
 * 以 `set:html` 注入，避免为一个图标引入组件开销。
 */

const FA_SOLID: Record<string, string> = {
  code: 'code',
  folder: 'folder',
  globe: 'globe',
  refresh: 'arrows-rotate',
  copy: 'copy',
  search: 'magnifying-glass',
  moon: 'moon',
  sun: 'sun',
  dashboard: 'table-cells-large',
  'arrow-up-right': 'arrow-up-right',
  'arrow-down': 'arrow-down',
  'arrow-up': 'arrow-up',
  'arrow-left': 'arrow-left',
  'arrow-right': 'arrow-right',
  'chevron-down': 'chevron-down',
  pause: 'pause',
  music: 'music',
  playlist: 'list-music',
  previous: 'chevron-left',
  next: 'chevron-right',
  play: 'play',
  check: 'check',
  sparkle: 'sparkles',
  asterisk: 'asterisk',
  close: 'xmark',
  plus: 'plus',
  hash: 'hashtag',
  grid: 'grid-2',
  pin: 'location-dot',
  image: 'image',
  edit: 'pen-to-square',
  trash: 'trash-can',
  calendar: 'calendar-days',
  heat: 'fire',
  words: 'file-lines',
  reading: 'book-open',
  print: 'print',
  clock: 'clock',
  share: 'share-nodes',
  comment: 'comment',
  person: 'user',
  email: 'envelope',
  rss: 'rss',
  link: 'link',
};

const FA_BRANDS: Record<string, string> = {
  wordpress: 'wordpress',
  github: 'github',
  bilibili: 'bilibili',
  weibo: 'weibo',
  mastodon: 'mastodon',
  telegram: 'telegram',
  wechat: 'weixin',
  x: 'x-twitter',
};

/** 内联 SVG 路径表，与原主题完全一致。 */
const SVG_PATHS: Record<string, string> = {
  code: '<path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18"/>',
  folder: '<path d="M3 7V5h6l2 3h10v12H3Z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 6h14M5 18h14"/>',
  wordpress:
    '<circle cx="12" cy="12" r="9"/><path d="m5 7 4 11 3-8 3 8 4-11M4 7h5m1 0h5"/>',
  refresh: '<path d="M20 7v5h-5M20 12a8 8 0 1 0-2 5"/>',
  copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  search: '<circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/>',
  moon: '<path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a9 9 0 1 0 11 11Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  dashboard:
    '<rect class="feng-dashboard-long" x="3" y="3" width="18" height="6" rx="2"/><circle class="feng-dashboard-dot" cx="6" cy="18" r="3"/><rect class="feng-dashboard-short" x="14" y="15" width="7" height="6" rx="2"/>',
  'arrow-up-right': '<path d="M7 17 17 7M7 7h10v10"/>',
  'arrow-down': '<path d="M12 4v16m-6-6 6 6 6-6"/>',
  'arrow-up': '<path d="M12 20V4m-6 6 6-6 6 6"/>',
  'arrow-left': '<path d="M20 12H4m6-6-6 6 6 6"/>',
  'arrow-right': '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  music:
    '<path d="M9 18V5l12-2v13M9 9l12-2"/><ellipse cx="6" cy="18" rx="3" ry="3"/><ellipse cx="18" cy="16" rx="3" ry="3"/>',
  playlist: '<path d="M4 6h16M4 12h10M4 18h8m6-5 4 3-4 3Z"/>',
  previous: '<path d="M5 5v14m14-14L8 12l11 7Z"/>',
  next: '<path d="M19 5v14M5 5l11 7-11 7Z"/>',
  play: '<path d="m7 4 13 8-13 8Z"/>',
  check: '<path pathLength="1" d="m5 12 4 4L19 6"/>',
  sparkle:
    '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/>',
  asterisk:
    '<path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M5.6 18.4 18.4 5.6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  wechat:
    '<path d="M13 15a8 8 0 0 1-5 0l-4 2 1-4a6 6 0 0 1-2-4c0-4 4-6 8-6 4 0 7 2 7 5"/><path d="M21 18l1 3-4-1c-4 1-8-1-8-5s3-6 7-6 6 3 6 6c0 1-1 3-2 3Z"/><path d="M7 8h.01M12 8h.01M15 14h.01M19 14h.01"/>',
  x: '<path d="M4 3h5l11 18h-5L4 3Zm0 18L20 3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  hash: '<path d="M10 3 8 21M16 3l-2 18M4 9h16M3 15h16"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  image:
    '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m4 18 6-6 4 4 3-3 4 4"/>',
  edit: '<path d="m14 5 5 5M4 20l5-1L20 8a3.5 3.5 0 0 0-5-5L4 14Z"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  dice:
    '<rect x="3" y="3" width="18" height="18" rx="4"/><g data-dice-face="1" style="display:none"><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/></g><g data-dice-face="2" style="display:none"><circle cx="8" cy="8" r="1.2" fill="currentColor" stroke="none"/><circle cx="16" cy="16" r="1.2" fill="currentColor" stroke="none"/></g><g data-dice-face="3" style="display:none"><circle cx="8" cy="8" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="16" cy="16" r="1.2" fill="currentColor" stroke="none"/></g><g data-dice-face="4" style="display:none"><circle cx="8" cy="8" r="1.2" fill="currentColor" stroke="none"/><circle cx="16" cy="8" r="1.2" fill="currentColor" stroke="none"/><circle cx="8" cy="16" r="1.2" fill="currentColor" stroke="none"/><circle cx="16" cy="16" r="1.2" fill="currentColor" stroke="none"/></g><g data-dice-face="5"><circle cx="8" cy="8" r="1.2" fill="currentColor" stroke="none"/><circle cx="16" cy="8" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="8" cy="16" r="1.2" fill="currentColor" stroke="none"/><circle cx="16" cy="16" r="1.2" fill="currentColor" stroke="none"/></g><g data-dice-face="6" style="display:none"><circle cx="8" cy="7" r="1.2" fill="currentColor" stroke="none"/><circle cx="16" cy="7" r="1.2" fill="currentColor" stroke="none"/><circle cx="8" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="16" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="8" cy="17" r="1.2" fill="currentColor" stroke="none"/><circle cx="16" cy="17" r="1.2" fill="currentColor" stroke="none"/></g>',
  calendar:
    '<rect x="3" y="5" width="18" height="16" rx="4"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2"/>',
  heat: '<path d="M13 3c1 5-5 5-3 10 2 0 4-2 4-4 3 3 5 5 4 8a7 7 0 0 1-13-1c-1-3 1-6 3-8 0 3 1 4 2 4"/>',
  words: '<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8m-8 4h8m-8 4h5"/>',
  reading:
    '<path d="M12 5C9 3 5 3 2 4v15c3-1 7-1 10 1m0-15c3-2 7-2 10-1v15c-3-1-7-1-10 1V5Z"/>',
  print: '<path d="M6 8V3h12v5M6 17H3V8h18v9h-3M6 14h12v7H6zM17 11h1"/>',
  clock: '<circle cx="12" cy="13" r="8"/><path d="M12 9v5l3 2M9 2h6"/>',
  share:
    '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m9 10 6-4m-6 8 6 4"/>',
  comment:
    '<path d="M21 11.5a9 9 0 0 1-13 8L3 21l1.5-5A9 9 0 1 1 21 11.5Z"/><path d="M8 13c2 2 5 2 7 0"/>',
  person: '<circle cx="12" cy="7" r="4"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>',
  github:
    '<path d="M9 19c-4 1-4-2-6-2m12 5v-4c0-1-.3-1.8-1-2 3-.4 6-1.5 6-6a5 5 0 0 0-1.5-3.5A5 5 0 0 0 18 3s-1 0-3 1a14 14 0 0 0-6 0C7 3 6 3 6 3a5 5 0 0 0-.5 3.5A5 5 0 0 0 4 10c0 4.5 3 5.6 6 6-.7.2-1 1-1 2v4"/>',
  bilibili:
    '<rect x="3" y="6" width="18" height="14" rx="4"/><path d="m7 2 3 4m7-4-3 4M8 11v3m8-3v3m-6 2 2 1 2-1"/>',
  weibo:
    '<ellipse cx="10" cy="15" rx="8" ry="5"/><ellipse cx="9" cy="15" rx="3" ry="2"/><path d="M4 11 7 5l2 5 6-3v5m2-9c3 0 5 2 5 5m-5-2c1 0 2 1 2 2"/>',
  mastodon:
    '<path d="M19 17c-2 1-6 1-10 0v2c3 1 5 1 7 0v3c-7 1-12-1-12-7V7c0-6 16-6 16 0v6c0 2-1 3-3 3H8V8c0-3 4-3 4 0v5-5c0-3 4-3 4 0v5"/>',
  telegram: '<path d="m2 11 20-8-4 18-6-5-4 3 1-7 10-6-10 8z"/>',
  email: '<rect x="2" y="4" width="20" height="16" rx="3"/><path d="m3 6 9 7 9-7"/>',
  rss: '<path d="M4 3a17 17 0 0 1 17 17M4 10a10 10 0 0 1 10 10"/><circle cx="5" cy="19" r="1"/>',
  link: '<path d="m10 13 4-4M8 15l-2 2a3.5 3.5 0 0 1-5-5l4-4a3.5 3.5 0 0 1 5 0m4 1 2-2a3.5 3.5 0 0 1 5 5l-4 4a3.5 3.5 0 0 1-5 0"/>',
};

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * 生成图标 HTML。
 *
 * @param name  图标名，见 {@link FA_SOLID} / {@link FA_BRANDS} / {@link SVG_PATHS}
 * @param className 额外 class
 */
export function icon(name: string, className = ''): string {
  const extra = className ? ` ${escapeAttr(className)}` : '';

  if (name === 'github' || name === 'x') {
    const lordicon = name === 'x' ? 'twitter' : 'github';
    const brand = name === 'x' ? 'x-twitter' : 'github';
    return `<span class="feng-icon feng-brand-animation ${escapeAttr(className)}" data-lordicon-content="${lordicon}" aria-hidden="true"><i class="fa-brands fa-${brand}"></i></span>`;
  }

  if (name === 'pageprev' || name === 'pagenext') {
    const dir = name === 'pageprev' ? 'left' : 'right';
    return `<span class="feng-icon" data-lordicon-content="${name}" aria-hidden="true"><i class="fa-solid fa-circle-chevron-${dir}"></i></span>`;
  }

  if (name === 'copy' || name === 'copyright') {
    return `<span class="feng-icon ${escapeAttr(className)}" data-lordicon-content="${name}" aria-hidden="true"><i class="fa-regular fa-${name}"></i></span>`;
  }

  if (FA_BRANDS[name]) {
    return `<i class="feng-icon feng-fa feng-icon-${name} fa-brands fa-${FA_BRANDS[name]}${extra}" aria-hidden="true"></i>`;
  }

  if (FA_SOLID[name]) {
    return `<i class="feng-icon feng-fa feng-icon-${name} fa-classic fa-regular fa-${FA_SOLID[name]}${extra}" aria-hidden="true"></i>`;
  }

  if (name === 'dice') {
    const faces = [1, 2, 3, 4, 5, 6]
      .map((n) => {
        const words = ['one', 'two', 'three', 'four', 'five', 'six'];
        return `<i class="feng-fa fa-solid fa-dice-${words[n - 1]}" data-dice-face="${n}" style="display:none"></i>`;
      })
      .join('');
    return `<span class="feng-icon feng-fa-dice ${escapeAttr(className)}" aria-hidden="true"><i class="feng-fa fa-solid fa-dice" data-dice-default></i>${faces}</span>`;
  }

  const paths = SVG_PATHS[name];
  if (!paths) return '';
  return `<svg class="feng-icon feng-icon-${name}${extra}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
}

/** 社交链接图标（Font Awesome class），与原主题 feng_social_links() 一致。 */
export const SOCIAL_ICONS: Record<string, string> = {
  github: 'fa-brands fa-github',
  x: 'fa-brands fa-x-twitter',
  bilibili: 'fa-brands fa-bilibili',
  weibo: 'fa-brands fa-weibo',
  mastodon: 'fa-brands fa-mastodon',
  telegram: 'fa-brands fa-telegram',
  email: 'fa-solid fa-envelope',
  rss: 'fa-solid fa-rss',
};
