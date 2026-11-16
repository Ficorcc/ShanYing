---
title: "开栏：这是一篇示例文章"
slug: "hello-world"
date: "2026-01-01"
author: "Your Name"
category: "随笔"
tags:
  - "示例"
excerpt: "这是一篇示例文章，用来演示 frontmatter 的写法与页面渲染效果，可以直接删掉。"
summary: "示例文章的作用是让你一眼看到 frontmatter 有哪些字段、页面会渲染成什么样。删掉它不影响任何功能。"
draft: false
cover: "/assets/images/hero-fuji/day.webp"
---

这是一篇示例文章。

## frontmatter 字段

| 字段 | 必填 | 说明 |
| :-- | :-- | :-- |
| `title` | 是 | 文章标题 |
| `slug` | 否 | 路由 `/essay/<slug>`，缺省用文件名 |
| `date` | 是 | 发布时间 |
| `author` | 否 | 作者，缺省回落到 `SITE.author` |
| `category` | 否 | 文章分类，会生成 `/essay/category/<分类>/` |
| `tags` | 否 | 标签，会生成 `/tags/<标签>/` |
| `excerpt` | 否 | 摘要短句：列表卡片、RSS、meta description、搜索都用它 |
| `summary` | 否 | 摘要长句：文章页「内容提要」折叠块用它，缺省回落到 `excerpt` |
| `cover` | 否 | 封面图，缺省取正文首图 |
| `updated` | 否 | 更新时间，缺省用 `date` |
| `draft` | 否 | `true` 时不发布 |

正文用标准 Markdown 写，行内 HTML 也支持（图片网格可用 `<div class="lared-grid-2">`）。

> 把这篇删掉，换成你自己的文章就好。
