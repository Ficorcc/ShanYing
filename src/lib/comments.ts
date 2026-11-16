/**
 * 评论数据聚合。
 *
 * 评论同样有两个来源：
 *   - CMS 里的 `src/data/comments.json`（构建期可读的静态评论）
 *   - 运行期通过前台评论表单或 `/admin` 写入 `var/store.json` 的新评论
 *
 * 前端提交评论后会软导航回评论锚点重新拉取页面，所以承载评论的页面
 * （文章详情页、留言页）必须按请求渲染，否则新评论不会立刻出现。
 */
import { comments as seedComments, type Comment } from './data';
import { getStore } from './store';

/** 全站评论：CMS 静态评论 + 运行期新增（运行期同 id 以 CMS 为准）。 */
export async function loadAllComments(): Promise<Comment[]> {
  const store = await getStore();
  const base: Comment[] = seedComments.map((comment) => ({ ...comment }));
  const known = new Set(base.map((comment) => comment.id));
  return [...base, ...store.comments.filter((comment) => !known.has(comment.id))];
}

/** 某篇文章 / 留言页的已批准评论，按时间正序。 */
export async function loadPostComments(postId: string): Promise<Comment[]> {
  const all = await loadAllComments();
  return all
    .filter((comment) => comment.postId === postId && comment.approved)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** 留言页的已批准评论，按时间倒序（最新在前）。 */
export async function loadGuestbookComments(): Promise<Comment[]> {
  const all = await loadAllComments();
  return all
    .filter((comment) => comment.postId === 'guestbook' && comment.approved)
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** 全站已批准评论数。 */
export async function totalApprovedComments(): Promise<number> {
  const all = await loadAllComments();
  return all.filter((comment) => comment.approved).length;
}
