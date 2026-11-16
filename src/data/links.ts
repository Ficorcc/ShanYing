export interface LinkItem {
  id: string;
  name: string;
  url: string;
  description: string;
  avatar: string;
  feed?: string;
  is_active?: boolean;
  status?: 'unknown' | 'online' | 'offline';
  statusCode?: number;
  lastChecked?: string;
  lastError?: string;
}

export interface SiteInfo {
  title: string;
  url: string;
  description: string;
  avatar: string;
}

export const siteInfo: SiteInfo = {
  title: '山映 · ShanYing',
  url: 'https://example.com',
  description: '在路上的思绪与脚印',
  avatar: '',
};

/**
 * 友链数据。
 *
 * 这个文件可以交给任意 CMS 后台读写，字段名保持如下结构即可：
 *   feed         订阅地址（后台用它自动生成订阅源）
 *   is_active    是否启用
 *   status       站点状态 unknown / online / offline
 * 手动新增时，id 建议使用稳定字符串，避免后台重新生成。
 */
export const links: LinkItem[] = []
