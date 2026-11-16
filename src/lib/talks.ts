/**
 * 说说数据聚合。
 *
 * 说说有两个来源：
 *   - CMS 里的 `src/data/memos.json`（构建期可读的静态内容）
 *   - 运行期通过 `/admin` 或前台发布接口写入 `var/store.json` 的新增条目
 *
 * 前端首屏的说说板子是服务端渲染出来的（`feng-talk` 模块只在翻页和展开详情时
 * 才调 `feng_talk_read`），所以页面渲染与 API 必须用同一个聚合函数，
 * 否则「在管理页发布了说说，回到前台却看不到」。
 */
import { publicMemos } from './content';
import { getStore } from './store';

/** 聚合后的说说条目。字段取 CMS 与运行期两边的并集。 */
export interface MergedTalk {
  id: string;
  memosName?: string;
  content: string;
  visibility: 'PUBLIC' | 'PROTECTED' | 'PRIVATE';
  createdAt: string;
  updatedAt?: string;
  pinned?: boolean;
  keywords?: string[];
  location?: string;
  resources?: { name?: string; url?: string; filename?: string; type?: string }[];
}

/**
 * 读取全部说说：CMS 静态内容 + 运行期新增，按置顶优先、时间倒序排列。
 * 运行期条目若与 CMS 同 id，以 CMS 为准（CMS 是权威来源）。
 */
export async function loadTalks(): Promise<MergedTalk[]> {
  const store = await getStore();
  const base: MergedTalk[] = publicMemos().map((memo) => ({
    id: memo.id,
    memosName: memo.memosName,
    content: memo.content,
    visibility: memo.visibility,
    createdAt: memo.createdAt,
    updatedAt: memo.updatedAt,
    pinned: memo.pinned,
    keywords: [],
    location: undefined,
    resources: memo.resources ?? [],
  }));
  const known = new Set(base.map((memo) => memo.id));
  const runtime: MergedTalk[] = store.talks
    .filter((memo) => !known.has(memo.id))
    .map((memo) => ({
      id: memo.id,
      memosName: memo.memosName,
      content: memo.content,
      visibility: memo.visibility,
      createdAt: memo.createdAt,
      updatedAt: memo.updatedAt,
      pinned: memo.pinned,
      keywords: memo.keywords ?? [],
      location: memo.location,
      resources: memo.resources ?? [],
    }));
  return [...base, ...runtime].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.createdAt.localeCompare(a.createdAt);
  });
}
