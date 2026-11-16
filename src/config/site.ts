/**
 * 全站站点信息。改这里就能换标题、域名、作者等。
 * 注意：url 同时被 astro.config.mjs 读取，改完记得重启 dev server。
 */
export const SITE = {
  title: '山映 · ShanYing',
  subtitle: '在路上的思绪与脚印',
  description:
    '一个由 Astro 驱动的静态博客：技术折腾、随笔写作、友链订阅与说说动态，内容以 Markdown 存放，随手可改。',
  url: 'https://example.com',
  lang: 'zh-CN',
  author: 'Your Name',
  email: 'you@example.com',
  /** 文章前缀，路由为 /essay/<slug> */
  postBase: '/essay',
  /** 订阅源列表文件（CMS 读写） */
  feedFile: 'src/config/feed.json',
  /** 说说列表文件（CMS 读写） */
  memosFile: 'src/data/memos.json',
  /** 评论列表文件（CMS 读写） */
  commentsFile: 'src/data/comments.json',
  /** 友链数据文件（CMS 读写） */
  linksFile: 'src/data/links.ts',
  /** Waline 评论服务器地址，留空则不渲染评论区 */
  waline: {
    serverUrl: '',
  },
} as const

export const NAV = [
  { href: '/', label: '首页' },
  { href: '/essay/', label: '文章' },
  { href: '/archives/', label: '归档' },
  { href: '/tags/', label: '标签' },
  { href: '/friends/', label: '友链' },
  { href: '/subscribe/', label: '订阅' },
  { href: '/moments/', label: '说说' },
  { href: '/about/', label: '关于' },
] as const
