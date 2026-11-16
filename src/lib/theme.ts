/**
 * 山映主题设置。
 *
 * 原 WordPress 主题把这些选项存在 `wp_options`（后台「外观 → ShanYing 设置」）。
 * 移植成 Astro 后没有后台数据库，改为在这里集中配置 —— 键名与原主题保持一致，
 * 方便对照迁移。
 *
 * 需要运行时可变的数据（浏览量、评论、访客统计）走 /api 端点，不写在这里。
 */
import { SITE } from '../config/site';

export type Scheme = 'system' | 'light' | 'dark';

export interface MusicTrack {
  title: string;
  artist: string;
  url: string;
  cover?: string;
  lyrics?: string;
}

export interface ThemeSettings {
  /** 深浅配色：system 跟随系统，light / dark 强制 */
  default_scheme: Scheme;
  /** 首页 Hero 顶部问候语 */
  xf_eyebrow: string;
  /** Hero 副标题 */
  xf_hero_intro: string;
  /** 首页分类最多展示几个 */
  home_category_slots: number;

  /** 个人资料 */
  profile_name: string;
  profile_avatar: string;
  profile_tagline: string;
  profile_location: string;
  hero_portrait: string;
  hero_photo_1: string;
  hero_photo_2: string;
  hero_photo_3: string;
  hero_photo_4: string;

  /** 问候 / 天气 / 智能场景 */
  greeting_enabled: boolean;
  greeting_pet: boolean;
  greeting_weather: boolean;
  weather_visitor: boolean;
  weather_animation: boolean;
  greeting_weather_service: 'openmeteo' | 'wttr';
  hero_smart_scene: boolean;
  hero_scene_animation: boolean;
  hero_scene_preview: 'auto' | 'day' | 'night' | 'sunset' | 'dawn' | 'cloud' | 'rain' | 'snow';

  /** 音乐播放器 */
  music_enabled: boolean;
  music_tracks: MusicTrack[];
  hero_music: string;

  /** 桌面宠物 */
  pet_enabled: boolean;
  pet_kind: string;
  pet_name: string;
  pet_food: string;
  pet_side: 'left' | 'right';
  /** 移动端是否隐藏宠物 */
  pet_mobile: boolean;

  /** 文章与评论 */
  posts_per_page: number;
  comment_placeholder: string;
  article_copyright: boolean;
  article_license: 'reserved' | 'by' | 'by-nc-sa' | 'custom';
  article_license_note: string;
  article_stale_days: number;

  /** 页脚 */
  footer_stats: boolean;
  footer_background: string;
  footer_seasonal: boolean;
  icp_number: string;
  police_number: string;
  site_since: string;

  /** 社交链接 */
  social_github: string;
  social_x: string;
  social_bilibili: string;
  social_weibo: string;
  social_mastodon: string;
  social_telegram: string;
  social_email: string;
  social_rss: boolean;
}

export const THEME: ThemeSettings = {
  default_scheme: 'system',
  xf_eyebrow: '你好，欢迎来到我的生活切片',
  xf_hero_intro: '',
  home_category_slots: 5,

  profile_name: SITE.author,
  profile_avatar: '/assets/images/brand/polar-icon.png',
  profile_tagline: SITE.subtitle,
  profile_location: '',
  hero_portrait: '/assets/images/brand/polar-icon.png',
  hero_photo_1: '',
  hero_photo_2: '',
  hero_photo_3: '',
  hero_photo_4: '',

  greeting_enabled: true,
  greeting_pet: true,
  greeting_weather: true,
  weather_visitor: true,
  weather_animation: true,
  greeting_weather_service: 'openmeteo',
  hero_smart_scene: true,
  hero_scene_animation: true,
  hero_scene_preview: 'auto',

  music_enabled: true,
  music_tracks: [],
  hero_music: '',

  pet_enabled: true,
  // 原主题只内置了「小鸟」一种宠物，形象为 pet-bird.svg
  pet_kind: 'bird',
  pet_name: '啾啾',
  pet_food: '谷粒',
  pet_side: 'right',
  pet_mobile: true,

  posts_per_page: 10,
  comment_placeholder: '一句走心评论，胜过千言万语。',
  article_copyright: true,
  article_license: 'reserved',
  article_license_note: '',
  // 过期提示阈值（天）。站内现在有大量回溯旧文，180 天会让每篇都挂「未更新」，
  // 故关掉；置 0 即不显示该提示。
  article_stale_days: 0,

  footer_stats: true,
  footer_background: '',
  footer_seasonal: true,
  icp_number: '',
  police_number: '',
  site_since: '2024-01-01',

  // 社交账号：留空则不渲染对应图标；GitHub 填了还会驱动首页的动态统计。
  social_github: '',
  social_x: '',
  social_bilibili: '',
  social_weibo: '',
  social_mastodon: '',
  social_telegram: '',
  social_email: '',
  social_rss: true,
};

/** 社交链接清单，顺序与原主题 feng_social_links() 一致。 */
export function socialLinks() {
  const items: { key: string; label: string; url: string }[] = [
    { key: 'github', label: 'GitHub', url: THEME.social_github },
    { key: 'x', label: 'X / Twitter', url: THEME.social_x },
    { key: 'bilibili', label: '哔哩哔哩', url: THEME.social_bilibili },
    { key: 'weibo', label: '微博', url: THEME.social_weibo },
    { key: 'mastodon', label: 'Mastodon', url: THEME.social_mastodon },
    { key: 'telegram', label: 'Telegram', url: THEME.social_telegram },
    { key: 'email', label: '电子邮箱', url: THEME.social_email ? `mailto:${THEME.social_email}` : '' },
    { key: 'rss', label: 'RSS 订阅', url: THEME.social_rss ? '/rss.xml' : '' },
  ];
  return items.filter((item) => item.url);
}

/** 四季底图（与原主题 assets/images/seasons/ 对应）。 */
export function seasonOf(date: Date): 'spring' | 'summer' | 'autumn' | 'winter' {
  const month = date.getMonth() + 1;
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}

/** Hero 智能场景图集（与原主题 assets/images/hero-fuji/ 对应）。 */
export const SCENE_IMAGES: Record<string, string> = {
  dawn: '/assets/images/hero-fuji/dawn.webp',
  day: '/assets/images/hero-fuji/day.webp',
  sunset: '/assets/images/hero-fuji/sunset.webp',
  night: '/assets/images/hero-fuji/night.webp',
  cloud: '/assets/images/hero-fuji/cloud.webp',
  rain: '/assets/images/hero-fuji/rain.webp',
  snow: '/assets/images/hero-fuji/snow.webp',
};
