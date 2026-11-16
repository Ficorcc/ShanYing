import feedRaw from '../config/feed.json'
import commentsRaw from '../data/comments.json'
import memosRaw from '../data/memos.json'
import { links, siteInfo } from '../data/links'

export interface MemoResource {
  name?: string
  filename?: string
  type?: string
  url?: string
}

export interface Memo {
  id: string
  memosName?: string
  content: string
  visibility: 'PUBLIC' | 'PROTECTED' | 'PRIVATE'
  createdAt: string
  updatedAt?: string
  pinned?: boolean
  resources?: MemoResource[]
}

export interface Comment {
  id: string
  postId: string
  author: string
  email: string
  content: string
  date: string
  approved: boolean
  status?: 'approved' | 'waiting' | 'spam'
  link?: string
  source?: 'local' | 'waline'
  reply?: string
}

export interface FeedItem {
  title: string
  url: string
  date?: string
  summary?: string
}

export interface Subscription {
  name: string
  url: string
  feedUrl: string
  avatar?: string
  description?: string
  updated?: string
  latestItems?: FeedItem[]
}

export interface FeedConfig {
  siteTitle: string
  siteDescription: string
  siteUrl: string
  feedUrl: string
  author?: string
  language?: string
  subscriptions?: Subscription[]
}

export const memos = memosRaw as unknown as Memo[]
export const comments = commentsRaw as unknown as Comment[]
export const feed = feedRaw as unknown as FeedConfig

export { links, siteInfo }

/** 说说按置顶优先、时间倒序 */
export function sortedMemos(): Memo[] {
  return [...memos].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return b.createdAt.localeCompare(a.createdAt)
  })
}
