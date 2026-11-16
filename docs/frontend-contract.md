# 山映 ShanYing → Astro 前端契约

> 来源：`/tmp/shanying/ShanYing-main/` 的 JS 源码（`tools/polar-assets/source/assets/js/`）
> 与 PHP（`functions.php`、`inc/inc-*.php`）；构建产物 `public/assets/js/main.js` 行为一致。
>
> 本文档记录**移植时必须遵守的接口约定**，改动前端 JS 或 API 时请一并更新。

## 0. 模块开关（最容易踩的坑）

构建脚本把每个模块包成：

```js
;window.polarEnabledScripts = JSON.parse(document.currentScript?.dataset.shanyingModules || '[]');
if (window.polarEnabledScripts.includes('xf-app')) { /* app.js 全文 */ }
```

Astro 侧必须在 `<script>` 上输出 `data-shanying-modules`，否则除 SunCalc、Lucide
bundle、`stat-roll.js` 三个未门控段外，**所有模块都不执行**，页面只剩 CSS 不动。

当前全量白名单（顺序与 `inc/asset-bundles.json` 一致）：

```
xf-app, feng-navigation, feng-dashboard, feng-toast, feng-friend-avatar, feng-feed,
feng-music, feng-activity, feng-talk, feng-comment-profile, feng-pet-motion, feng-pet,
feng-reading, feng-related, feng-home-profile, feng-context, feng-jieqi,
feng-image-fade, feng-greeting, feng-visitor-stats
```

> `feng-travel`（旅行足迹地图）已随 `/footprint/` 页面一并移除，不在白名单内。
> 若日后要恢复，把模块名加回 `src/layouts/BaseLayout.astro` 的 `ALL_MODULES`，
> 并恢复 `src/pages/footprint.astro` 与 `PostMeta.travel`。

原 WordPress 主题把这些脚本几乎全部无条件 enqueue，各模块内部再按 DOM 选择器自我
守卫（`if(!root)return;`），因此 Astro 侧同样**全量开启，页面差异靠 DOM 表达**。

## 1. AJAX 端点表

原端点 `admin-ajax.php` 已迁移到 `/api/ajax`，用 `?action=feng_xxx` 调度。
响应统一为 `{ success: boolean, data: <payload> }`；失败时 `data.message` 为可读文案。

| action | 方法 | 参数 | 前端读取的字段 | 写数据 |
| --- | --- | --- | --- | --- |
| `feng_activity` | GET | `page` | `data.html`, `data.page`, `data.pages` | 否 |
| `feng_hub` | GET | `category`, `type`, `page` | `data.html` | 否 |
| `feng_hero_activity` | GET | — | `data.counts`, `data.badges`, `data.visitors` | 否 |
| `feng_heatmap_day` | GET | `date` | `data.html` | 否 |
| `feng_dashboard` | GET | `part`, `month` | `data.html` | 否 |
| `feng_random_article` | GET | `exclude` | `data.url` | 否 |
| `feng_github_stats` | GET | — | `data.html` | 否 |
| `feng_greeting_identity` | POST | — | `data.name` | 否 |
| `feng_weather` | GET | `kind`(`host`/`visitor`) | `data.city`, `data.temperature`, `data.code`, `data.day`, `data.sunrise[]`, `data.sunset[]`, `data.utc_offset`, `data.latitude`, `data.longitude` | 否 |
| `feng_visitor_stats` | POST | `visitor`, `event` | `data.online`, `data.views`, `data.location.label`, `data.location.code` | **是** |
| `feng_feed_count` | GET | — | `data.today`, `data.midnight` | 否 |
| `feng_feed_list` | GET | `page`, `today` | `data.html`, `data.total`, `data.more` | 否 |
| `feng_talk_read` | GET | `op`(`session`/`list`/`detail`), `page`, `id` | `op=session` → `can_publish`/`can_manage`/`nonce`/`tags[]`；`op=list` → `html`/`total`/`more`；`op=detail` → `id`/`content`/`date_label`/`location`/`tags[]`/`images[]` | 否 |
| `feng_talk_write` | POST(FormData) | `op`(`save`/`delete`), `id`, `content`, `tags`, `location`, `nonce` | 仅 `success`，错误读 `data.message` | **是**（须带管理会话 Cookie，缺失返回 403） |
| `feng_comment` | POST(FormData) | `comment`, `author`, `email`, `url` | `data.message`, `data.url` | **是** |
| `feng_comment_self_edit` | POST | `id`, `token`, `content` | `data.content` | **是** |
| `feng_card_color` | GET | `post_id` | `data.color` | 否 |
| `feng_pet` | POST | `op`(`state`/`feed`/`pat`/`chat`), `nonce` | `data.state.*`, `data.message`, `data.mode` | **是** |
| `feng_friend_game` | POST | `op`(`list`/`start`/`score`/`player`), `size` | `data.scores[]`, `data.token`, `data.deck[]` | **是** |
| `feng_friend_send_code` | POST | `email` | `data.token`, `data.message` | **是** |

另有一条 REST 路由：

| 路由 | 方法 | 参数 | 响应 | 说明 |
| --- | --- | --- | --- | --- |
| `GET /api/comment-location/{id}` | GET | path `id` | `{ label, code }`（**无信封**） | 评论地理位置；`code` 为 2 位小写国码 |

管理接口 `/api/admin`（管理页专用，与上面是两条独立路由）：

| 动作 | 方法 | 参数 | 认证 | 说明 |
| --- | --- | --- | --- | --- |
| `GET /api/admin` | GET | `token`（可选） | 管理令牌 **或** 会话 Cookie | 概览 / 说说 / 评论 / 站点信息 |
| `POST /api/admin` `admin.login` | POST | `token` | 管理令牌 | 校验口令，**下发签名会话 Cookie**（`Set-Cookie: shanying_admin=…; HttpOnly; SameSite=Lax`） |
| `POST /api/admin` `admin.logout` | POST | — | 无 | 清除会话 Cookie |
| `POST /api/admin` 其余动作 | POST | `token` 或会话 Cookie | 管理令牌 **或** 会话 Cookie | `talk.save` / `talk.delete` / `comment.approve` / `comment.delete` / `settings.save` |

认证口径：

- 管理口令来自 `SHANYING_ADMIN_TOKEN`（Node 读 `.env`/环境变量，Cloudflare 读 Worker secret）。
  **没配置口令时整个 `/api/admin` 关闭**（返回 503），不做开发模式全开。
- 会话 Cookie 里只放「过期时间 + HMAC-SHA256 签名」，不放口令；口令一改，旧会话立刻失效。
- 前台说说页靠这个 Cookie 判断能不能发布（见 §3 说说）。

只给后台用的动作：`feng_feed_refresh`、`feng_ai`。

### 已知的实现差异

1. `feng_weather` 访客分支在关闭访客天气时返回 `{"success":true,"data":null}`，
   不是 404 —— 前端已判空。
2. `feng_hub` 只回 `data.html`，没有 `pages` 字段，前端也只读 `html`。
3. `feng_talk_read` 用 `url.search = ...` **整体替换**查询串，
   因此 endpoint 自身不能带额外 query 参数。
4. `feng_comment` 的原实现依赖 WordPress 表单全套字段（`comment_post_ID` 等），
   Astro 侧改为 `data-post-id` + `post_id` 兜底。

## 2. 前端配置 JSON（`#feng-config`）

```html
<script type="application/json" id="feng-config">{...}</script>
```

| 键 | 类型 | 消费点 | 说明 |
| --- | --- | --- | --- |
| `icons` | `object<string,string>` | `app.js`、`navigation.js` | `check` / `chevron-down` / `play` / `pause` 的内联 SVG |
| `endpoint` | `string` | `feed.js`、`visitor-stats.js`、`greeting.js` | AJAX 基址，当前为 `/api/ajax` |
| `commentLocationEndpoint` | `string` | `app.js` | 末尾**必须带斜杠**，前端直接拼接评论 ID |
| `greeting` | `object` | `greeting.js` | `enabled`/`pet`/`weather`/`service`/`site` |
| `pet` | `object` | `pet.js` | `url` + `nonce`；不存在即代表宠物模块关闭 |

## 3. DOM 契约（JS 依赖，缺失即静默失效）

### 全站

- `#xf-view`（渐进式导航整体替换的容器）、`#xf-content`
- `meta[name="xf-theme"]`、`meta[name="xf-navigation"]`（必须为 `on`）、
  `meta[name="feng-scheme"]`、`meta[name="feng-reveal"]`
- `[data-xf-status]`、`[data-xf-progress]`
- `.xf-header-search` > `form` > `input[name="s"]`；`[data-xf-search-open]`
- `[data-xf-theme-toggle]`、`[data-xf-top]`、`[data-feng-random]`（带 `data-endpoint`/`data-exclude`）
- `[data-xf-lazy-image]` 容器内需要 `<template>`
- `[data-xf-reveal]`（入场动画）、`[data-feng-share]`、`[data-feng-wechat]`
- `#commentform`（`#comment`/`#author`/`#email`/`#url`）+
  `[data-feng-comment-endpoint]`（端点 URL 放在这个属性上）+ `[data-feng-comment-status]` +
  `[data-feng-emojis]` > `.feng-emoji-options` > `button[data-feng-emoji]` + `[data-feng-emoji-more]`
- `[data-page-menu]` > `[data-page-tool=back|forward|reload|top|link-tab|link-window|link-copy|previous|next|comment|random|copy|theme]`
- `[data-jieqi-toggle]` > `[data-jieqi-state]`
- `[data-comment-geo]` > `[data-geo-label]`

### 首页

`[data-feng-greeting]`、`[data-hero-weather]`（带 `data-endpoint`/`data-visitor`）>
`[data-weather-date]`/`[data-weather-host]`/`[data-weather-visitor]`、`[data-smart-scene]`
（带 `data-scene-images` JSON）、`[data-github-stats]` > `[data-github-slot]`、
`[data-hero-activity]` > `.feng-heatmap` > `[data-profile-day]`（`data-level`）+
`[data-hero-badges]`+`[data-hero-visitors]`、`[data-stack-loading]` + `[data-corner]`、
`[data-profile-dialog]`、`[data-profile-calendar-dialog]`。

分类中枢：`.feng-article-hub` > `[data-collection-tab]`（`data-description`/`data-watermark`）
+ `[data-collection-panel]`（`data-hub-endpoint`/`data-hub-category`/`data-hub-lazy`）
+ `[data-hub-type]`/`[data-hub-page]`/`[data-hub-watermark]`/`[data-hub-description]`。
面板内容由 `feng_hub` 返回的 html **整体替换**。

### 文章页

`#xf-article-text[data-feng-reading]`、`aside#feng-article-toc[data-reading-tools]`
（内含 `details > nav > ol`、`[data-reading-close]`/`[data-reading-focus]`/`[data-reading-print]`）、
`.feng-entry-actions` 内的 `[data-reading-toggle]`、
`[data-related]` > `[data-related-panel]` > `.feng-related-item`（≥4 个）+ `[data-related-refresh]`。

### 说说 / 友链 / 订阅

- 说说：`[data-feng-talks]`（带 `data-endpoint`/`data-upload-*`/`data-page-url`）
  + `[data-talk-board]`（内容由 `feng_talk_read` 整体替换）+ 30 余个子选择器，
  详见 `src/pages/moments.astro`。
  - 底部工具栏：`[data-talk-publish]` 是**可见的发布按钮**（原主题此处是「登录后发布说说」的
    人形图标，现已改为发布按钮）；它点击时代为点击视觉隐藏的 `[data-talk-create]`
    —— 主题 JS 只认后者（`feng-talk` 模块按它决定能不能发布），所以两个节点都必须留在 DOM 里。
  - `[data-talk-login]`（→ `/admin/`）同样保留但视觉隐藏，主题 JS 会按登录状态切换它的 `hidden`。
  - 权限来自 `feng_talk_read?op=session` 的 `can_publish`：有管理会话 Cookie 时为真，
    此时点发布按钮直接打开页内编辑器；否则提示去 `/admin` 登录。
- 友链：`.feng-friend-group` > `.feng-friends` > `a.feng-friend-chip`（内含
  `img[data-friend-fallback]` + `.feng-friend-avatar-initial`），
  以及 `dialog#friend-application` / `#friend-site-info`。
  原主题的配对游戏区（`[data-friend-game]`、`[data-game-wall]`、`[data-emoji-game]`、
  `[data-game-player]`、`dialog#friend-game-ranks`）已在本站移除，前端 JS 对应模块
  均带 DOM 守卫，缺失时不会报错。
- 订阅：`[data-feed-page]` > `[data-feed-entries]`（内容由 `feng_feed_list` 整体替换）
  + `[data-feed-status]`/`[data-feed-more]`/`[data-feed-empty]`/`[data-feed-period]`。

### 控制面板

`#feng-dashboard`（带 `data-endpoint`）> `[data-feng-dashboard-content]`（整体替换 html）
+ `[data-dashboard-summary]`/`[data-dashboard-summary-slot]`/`[data-feng-calendar]`。

### 页脚统计

`[data-footer-stats]` 存在才发请求；写入 `[data-footer-views]`/`[data-footer-online]`/
`[data-footer-location]`。

## 4. 渐进式导航的兼容约束

`app.js` 的 `compatible(doc)` 要求：

1. `meta[name="xf-theme"]` 的内容一致；
2. `meta[name="xf-navigation"]` 为 `on`；
3. 存在 `#xf-view #xf-content`；
4. **各页面的 `<script src>` 列表完全一致**；
5. 页面里没有不支持的浏览器特性。

因此所有页面必须共用同一套 `BaseLayout`，脚本 `src` 不要按页增减
（`data-shanying-modules` 的取值可以变，但 `src` 不行）。

## 5. 外部依赖与降级

| 功能 | 依赖 | 无密钥 / 失败时的行为 |
| --- | --- | --- |
| 两地天气 | open-meteo + ipwho.is（均无需密钥） | 返回 `data:null`，`[data-hero-weather]` 保持 hidden |
| 访客定位 | api.cnip.io | `[data-footer-online]` 显示 `—` |
| GitHub 动态 | api.github.com（未认证，60 次/小时） | 显示「GitHub 暂未同步」 |
| 地图 | Mapbox / Google / 高德（需要 Key） | 无 Key 自动降级为 OpenStreetMap iframe |
| 节气提醒 | api.jieqi.dev | 脚本 onerror 后移除 |
| 音乐 | 第三方 MP3 / LRC 直链 | 歌单为空时播放相关控件 disabled |
| 宠物 AI | 用户自配的 OpenAI 兼容服务 | 退回本地日常问答，`data.mode='daily'`、`data.ai=false` |

## 6. 移植风险清单

1. 忘发 `data-shanying-modules` → 全站 JS 静默失效。
2. `endpoint` / `commentLocationEndpoint` 的路径或斜杠写错 → 对应模块取不到配置。
3. `feng_talk_read` 会覆盖整个 query string → endpoint 不能带参数。
4. 端点少一层 `{success,data}` 信封 → 前端一律显示「暂时无法…」。
5. 用 Astro Islands 会破坏 `xf:mounted` / `xf:before-unmount` 生命周期。
6. 各页 `<script src>` 不一致 → 渐进式导航判定「页面运行时不同」并回落到整页刷新。
7. **`querySelector` 查的是后代，不是自身**。
   `app.js` 取评论端点用的是 `commentForm.querySelector('[data-feng-comment-endpoint]')`，
   所以端点属性必须挂在**表单内部的隐藏域**上；挂在 `<form>` 自身上取不到，
   JS 不接管提交 → 表单走原生 POST → 评论全部丢失。
   同样的写法还有 `[data-feng-switch-profile]`。
8. **成对属性只加一半会抛 `TypeError`，反而打断整个模块**。
   `[data-comment-geo]` 与内部的 `[data-geo-label]`、
   `[data-hero-music]` 与 `[data-hero-music-state]`、
   `.feng-feed-badge` 内的 `.t-badge-dot` 与 `.screen-reader-text`，都要同时出现。
9. **类名同样是契约**。
   `.feng-related-item`（再读一篇条目）：缺失时 `items` 为空数组，
   `offset % items.length` = `NaN`，「换一组文章」按钮被**永久置灰**。
   `.feng-comment` + `.feng-comment__actions`：缺失时评论自助编辑不挂载。
10. **数字型 ID 约定**。
    原 WordPress 的评论 ID 是数字，DOM 上是 `comment-{数字}`；
    前端按 `/^#comment-\d+$/` 匹配锚点、按 `id.slice(8)` 取原始 ID。
    评论 ID 若写成 `comment-xxx`，锚点与自助编辑都会失效。
11. **Astro SSR 下 `getStaticPaths()` 被忽略**。
    动态路由若改 `export const prerender = false`，`Astro.props` 不再有值，
    必须在请求期自己按 `Astro.params` 查询内容集合。
12. **带运行期数据的页面必须按请求渲染**。
    说说、评论、浏览量这类运行期内容如果只在构建期烘焙，
    「在管理页发布 → 回前台看不到」。对应路由要 `prerender = false`，
    并把 CMS 静态内容与运行期存储（Node 平台为 `var/store.json`，Cloudflare 平台为 KV `SHANYING_STORE`）
    的内容合并后再渲染。
13. **原主题自身也有孤儿模板，不要误判成移植遗漏**。
    `template-parts/activity.php`（最近一周动态）、`template-parts/post-card.php`
    的卡片取色在原主题里就没有被任何地方引用，上游同样不渲染。

### 桌面宠物（`feng-pet` + `feng-pet-motion`）

入口：`[data-feng-pet]`，同时要求 `#feng-config` 里有 `pet: {url, nonce}`。

内部必需节点：`#feng-pet-panel`（**面板内必须有 `<footer>`**）、
`[data-pet-toggle]`、`[data-pet-status]`、`[data-pet-bubble]`、`[data-pet-close]`、
`[data-pet-hide]`、`.feng-pet-art`（内联 SVG，带 `data-pet-rig`）、
`[data-pet-form]`/`[data-pet-stage]`/`[data-pet-mood]`/`[data-pet-age]`/
`[data-pet-satiety]`/`[data-pet-food-meter]`/`[data-pet-xp]`/`[data-pet-progress]`/
`[data-pet-diary]`/`[data-pet-chat-mode]`/`[data-pet-ai-note]`/
`[data-pet-action=feed|pat]`/`[data-pet-conversation]`/`[data-pet-chat-form]`/
`[data-pet-question]`。

接口（`POST`，body 用 `URLSearchParams`）：

| op | 用途 | 响应 |
| --- | --- | --- |
| `state` | 拉快照；带 `post_id` 时额外返回阅读票据 `ticket` | `data.state`、`data.ai` |
| `feed` / `pat` | 投喂 / 摸头 | `data.state`、`data.message` |
| `read` | 兑换阅读成长（`post_id` + `ticket`） | `data.state`、`data.message` |
| `chat` | 日常问答 | `data.state`、`data.reply`、`data.mode`、`data.note` |

`data.state` 的字段名被 `pet.js` 的 `render()` 逐个读取，缺一个就是 `undefined`：
`level`、`xp`、`next`、`progress`、`form.{name,scale}`、`stage`、`mood`、
`satiety`、`age`、`streak`、`diary`（**字符串数组**）、`sleeping`。

前端会把整个 `<aside>` 搬进 `[data-feng-music]`（音乐播放器）或 `[data-feng-pet-slot]`（首页 Hero），
所以组件放在页脚即可。

文章页要让 `[data-feng-pet-post]` 是**数字**（`Number(dataset.fengPetPost)`），
否则阅读成长功能静默失效。
