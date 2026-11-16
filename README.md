# 山映 · ShanYing — Astro 主题

把 WordPress 主题 [山映 ShanYing](https://github.com/gentpan/shanying)（作者：西风 / xifeng.net，GPL-2.0-or-later）
整体移植为 **Astro** 主题：前台视觉与交互逐像素还原，PHP 模板层重写为 Astro 组件，
`admin-ajax.php` 顶替为 `/api/ajax` 服务端接口。

> 这是**可复用主题包**：`src/content/essay/` 里只有一篇示例文章，站点信息是占位值。
> 想直接看成品站点，去隔壁的 `站点文件/`。

---

## 快速开始

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # 产出静态页 + 服务端 bundle
npm run preview  # 跑构建产物（node dist/server/entry.mjs）
npx astro check  # 类型检查
```

Node ≥ 22.23.4。

## 三步变成自己的站

1. **改站点信息** —— `src/config/site.ts`
   标题、域名、作者、邮箱、导航项都在这里。`url` 同时被 `astro.config.mjs` 读取，改完重启 dev server。
2. **写文章** —— `src/content/essay/*.md`，frontmatter 字段见 `src/content/essay/hello-world.md` 的说明表格。
   目录刻意扁平，方便 CMS 用 `readdir` 遍历。
3. **填数据** —— 友链 `src/data/links.ts`、说说 `src/data/memos.json`、评论 `src/data/comments.json`、订阅源 `src/config/feed.json`。

社交账号在 `src/lib/theme.ts` 的 `social_*`：留空则不渲染图标；填了 GitHub 还会驱动首页的动态统计。

---

## 技术形态

| 项 | 方案 |
| :-- | :-- |
| 渲染 | **混合渲染** —— 内容页静态化，`/moments/`、`/essay/[slug]`、`/guestbook`、`/search` 与 `/api/*` 按请求渲染 |
| 适配器 | `@astrojs/cloudflare`（Workers，**默认**）/ `@astrojs/node`（standalone，`SHANYING_PLATFORM=node`） |
| 内容源 | Astro Content Collections（`src/content/essay/*.md`） |
| 主题样式 | 直接复用原生产物 `public/assets/css/main.css`（603KB，含完整 reset 与深浅配色变量） |
| 主题脚本 | 直接复用原生产物 `public/assets/js/main.js`（1.09MB，**零改动**） |
| 前端 API | 统一路由 `/api/ajax?action=feng_xxx`，响应保持 WP 的 `{ success, data }` 双层信封 |

> 为什么复用构建产物而不是重写样式？
> 山映的核心样式与交互是「双轨资源制」：`main.css` / `main.js` 由分册拼接而成，
> `main.js` 内部按 `data-shanying-modules` 白名单门控 20 个模块，且与 DOM 上的
> class / data 属性深度耦合。复用产物是唯一能保证行为完全一致的做法。

### 渲染边界

带运行期数据的页面必须按请求渲染，否则「发了评论 / 说说，前台却看不到」：

| 路由 | 方式 | 原因 |
| :-- | :-- | :-- |
| `/`、`/essay/`、`/archives/`、`/tags/`、`/friends/`、`/subscribe/`、`/about/` … | 静态化 | 内容来自 CMS，构建期烘焙 |
| `/moments/` | SSR | 说说可运行期发布 |
| `/essay/[slug]` | SSR | 评论可运行期新增，提交后软导航回本页 |
| `/guestbook/` | SSR | 同上 |
| `/search` | SSR | 按查询词实时过滤 |
| `/404` | SSR | 文章页 slug 找不到时要 `Astro.rewrite('/404')`；预渲染路由在服务端没有组件实例，rewrite 会抛 500 |
| `/api/*`、`/admin` | SSR | 接口与管理页 |

写操作落到平台相关的存储后端（Node → `var/store.json`，Cloudflare → KV），
页面按请求渲染时把 CMS 静态内容与运行期内容合并。

---

## 目录结构

```text
.
├── public/assets/            # 主题原生资源（css / js / images / fonts / models / vendor）
├── docs/frontend-contract.md # 前端 JS ↔ 服务端接口契约（移植必读）
├── var/store.json            # 运行时写操作存储（Node 平台；留言 / 说说 / 站点信息）
├── wrangler.jsonc            # Cloudflare Workers 配置（Worker 名 / KV 绑定 / 兼容标志）
└── src/
    ├── config/
    │   ├── site.ts           # 站点信息：标题、域名、作者、导航
    │   └── feed.json         # 订阅源列表
    ├── content/
    │   └── essay/            # 文章 Markdown（Content Collection）
    ├── data/
    │   ├── comments.json     # 评论
    │   ├── links.ts          # 友链
    │   └── memos.json        # 说说
    ├── layouts/BaseLayout.astro
    ├── lib/
    │   ├── theme.ts          # 主题开关（配色、问候语、宠物、节气……）
    │   ├── icons.ts          # 图标库
    │   ├── render.ts         # HTML 片段渲染器
    │   ├── talks.ts          # 说说聚合（CMS + 运行期）
    │   ├── comments.ts       # 评论聚合（CMS + 运行期）
    │   ├── pet.ts            # 桌面宠物的成长值规则
    │   ├── store.ts          # 运行时存储统一入口
│   └── store/
│       ├── types.ts              # 存储的数据形状与默认值
│       ├── backend.node.ts       # Node 后端：var/store.json
│       └── backend.cloudflare.ts # Cloudflare 后端：Workers KV
    │   └── …
    ├── components/           # Header / Footer / Dashboard / MusicPlayer / Hero / PetWidget / …
    └── pages/                # 页面路由（文章 / 归档 / 说说 / 友链 / 订阅 / 留言 / 关于 / 搜索 / 404 / admin）
```

---

## 部署到 Cloudflare

> **注意**：Astro 7 的 `@astrojs/cloudflare` 适配器**已移除 Cloudflare Pages 支持**，
> 官方建议迁移到 **Cloudflare Workers**。本项目按 Workers 形态构建。

```bash
npm install
npm run build          # 产出 dist/client（静态资源）+ dist/server（Worker 入口）
npx wrangler deploy    # 部署到 Workers
```

部署前先登录：

```bash
npx wrangler login
```

KV namespace **不用手动建**：第一次部署时 `wrangler.jsonc` 里只写绑定名、不写 `id`，
wrangler 会自动开通好并把 id 回填到配置里（KV id 不是密钥，可以直接入库）。
`SHANYING_STORE` 是本站的运行期数据，`SESSION` 是 Astro session 用的（适配器强制要求）。

`wrangler.jsonc` 里的关键项：

| 项 | 说明 |
| :-- | :-- |
| `name` | Worker 名字，也是 `*.workers.dev` 的第一段 |
| `kv_namespaces[SHANYING_STORE]` | 运行期数据（留言 / 说说 / 宠物进度 / 浏览量）的存储 |
| `compatibility_flags` | `nodejs_compat` |

### Git 自动部署

仓库里的 `.github/workflows/ci.yml` 会在 push 时自动做类型检查与构建。

要接自动部署，把 `.github/workflows/deploy.yml` 复制过去，并在仓库 **Secrets** 里加
`CLOUDFLARE_API_TOKEN`（Workers 部署权限）、**variable** 加 `CLOUDFLARE_ACCOUNT_ID`；
没配 secret 时工作流只构建不部署，任务依然通过，不会红叉。

`wrangler login` 拿到的 OAuth token 只有几小时有效期，**不适合**当 CI 凭据，
要用控制台签发的 API Token。

---

## 常用命令

| 命令 | 作用 |
| :-- | :-- |
| `npm run dev` | 本地开发（Node 运行时，文件存储），默认 <http://localhost:4321> |
| `npm run dev:cf` | 本地开发（Cloudflare workerd 运行时，KV 存储） |
| `npm run build` | 生产构建（Cloudflare Workers 产物），输出 `dist/client` + `dist/server` |
| `npm run build:node` | 生产构建（Node standalone 产物） |
| `npm run preview` | 用 workerd 预览构建产物 |
| `npm run deploy` | 部署到 Cloudflare Workers（`wrangler deploy`） |
| `npx astro check` | 类型与模板检查 |
| `npx astro dev --background` | 后台启动 dev server（`status` / `logs` / `stop` 管理） |

---
## 配置要点

### 站点信息
`src/config/site.ts` —— 标题、副标题、描述、域名、作者、导航项。
`url` 同时被 `astro.config.mjs` 读取，改完需重启 dev server。

它决定 canonical、RSS、sitemap 与 `feed.json` 里的绝对地址。
（`public/assets/css/main.css` 里那两处 `xifeng.net` 是原主题作者西风的署名声明，
按 GPL 保留原样，不属于站点域名。）

### 主题开关
`src/lib/theme.ts` —— 配色方案、问候语、桌面宠物、节气提醒、访客天气等。
对应原 WordPress 后台设置面板（不复刻后台 UI，改为代码配置）。

`article_stale_days` 默认置 0：站内若以回溯旧文为主，180 天的「未更新」提示会让每篇都挂横幅。

### 运行时存储位置

写操作（留言 / 说说 / 浏览量 / 访客统计 / 宠物状态 / 游戏成绩）的落点**随平台切换**，
接口是同一个（`src/lib/store.ts`），具体实现由 `astro.config.mjs` 的 `vite.resolve.alias` 切换：

| 平台 | 后端 | 落点 |
| :-- | :-- | :-- |
| Node（`npm run dev` / `build:node`） | `src/lib/store/backend.node.ts` | `<项目根>/var/store.json` |
| Cloudflare（`npm run build`） | `src/lib/store/backend.cloudflare.ts` | KV namespace `SHANYING_STORE`，key `shanying:store` |

Node 版的路径由「向上找 `astro.config.mjs`」推导，而不是按源码文件位置数层级 ——
打包后 `store.ts` 会被塞进 `dist/server/` 的 chunk 里，按层级算会落到 `dist/var/`，
重新构建即丢失数据。也可以用 `SHANYING_STORE_DIR=/data/blog` 指定持久化目录。

Cloudflare 版做了两件事：

- Workers 没有可写文件系统，所以改用 KV；没配 KV 绑定时不报错，
  读按空数据走、写静默丢弃，站点照常可用。
- KV 同一个 key 每秒只能写一次，所以写入做了节流与合并：
  相邻写入至少间隔 1 秒，等待期间到来的新写入会覆盖待写快照，一批突发只落一次盘。

部署到容器或只读环境时，请用 `SHANYING_STORE_DIR` 指向可持久化的卷，
否则运行时数据会随容器销毁而丢失。

### 管理页
`http://localhost:4321/admin` —— 站点信息、说说、留言、订阅源的管理界面。

- 写操作落到 `var/store.json`（**不在 `src/` 内**，避免触发内容集合重建）。
- **管理口令**：环境变量 `SHANYING_ADMIN_TOKEN`（Cloudflare 上是 Worker secret）。
  - 本地：写进项目根目录的 `.env`（已被 `.gitignore` 忽略）；
  - 线上：`npx wrangler secret put SHANYING_ADMIN_TOKEN`。
- 没配置口令时**管理接口整体关闭**（fail closed），不会像以前那样「开发模式全开」。
- 口令有两种用法：直接带 `token` 参数调用 `/api/admin`；或在管理页输入一次，
  换一个 **HttpOnly + SameSite=Lax 的签名会话 Cookie**（7 天有效）。
- 站点信息类改动写在静态页面里，需要**重新构建**才会在前台生效（页面内已提示）。

### 前台发布说说

说说页底部工具栏的**铅笔图标就是发布按钮**（原主题在这里放的是「登录后发布说说」的人形图标）：

- 点它 → 直接打开页内编辑器（正文 / 关键词 / 地点），发布后立刻出现在说说列表里；
- 权限跟着管理会话走：`/admin` 登录过 → 可发布可编辑；没登录 → 提示去 `/admin` 登录；
- 服务端也做了同样的校验：`feng_talk_write` 没有有效会话直接 403，光靠改前端绕不过去；
- 写操作带 `nonce`（会话派生），会话过期会被挡下并提示刷新。

### 桌面宠物

原主题的招牌互动（`feng-pet` + `feng-pet-motion` 两个模块）已完整移植：

- 组件 `src/components/PetWidget.astro`，形象为原主题自带的 `pet-bird.svg`（内联输出，带关节 rig 标记）。
- 成长值规则在 `src/lib/pet.ts`：阶段门槛（初遇 / 熟悉 / 亲近 / 默契 / 伙伴）、
  体型比例、饱食度衰减、投喂配额（每天 3 次、间隔半小时）与原主题一致。
- 互动写进 `var/store.json` 的 `pet` 字段。
- 未配置 AI 时，聊天走「日常问答」，按真实状态作答，不编造。

### 外部能力降级
天气、AI、GitHub 统计等外部能力均可能需要密钥。**拿不到时自动降级**，不会报错：
- 访客天气关闭时 `feng_weather` 返回 `data: null`（不是 404）；
- GitHub 公开事件接口取不到时，`feng_github_stats` 返回「GitHub 暂未同步」。

---

## 前端契约要点（改代码前必读）

完整契约见 `docs/frontend-contract.md`，以下是踩过坑的关键项：

1. **必须输出 `data-shanying-modules`**，否则 20 个模块全部被跳过、页面静默失效。
2. **`#feng-config` 的 `endpoint` 指向 `/api/ajax`**；`commentLocationEndpoint` 末尾**必须带斜杠**
   （前端直接拼评论 ID）。
3. **API 响应一律 `{ success: bool, data: {...} }`**，前端读的是 `result.data.*`。
   `/api/comment-location/{id}` 例外，直接返回 `{ label, code }`。
4. **DOM 层级陷阱**：前端常用 `form.querySelector('[data-xxx]')` 查的是**后代**，
   属性必须挂在表单内部的隐藏域上（如 `data-feng-comment-endpoint`）。
5. **成对属性缺一半会抛 `TypeError` 打断整个模块**：
   `data-comment-geo` + `[data-geo-label]`、`data-hero-music` + `[data-hero-music-state]`、
   `.feng-feed-badge` 内 `.t-badge-dot` + `.screen-reader-text`。
6. **类名即契约**：`.feng-related-item`、`.feng-comment` + `.feng-comment__actions`。
7. **数字型 ID 约定**：评论 ID 是数字，DOM 上是 `comment-{数字}`，锚点匹配 `/^#comment-\d+$/`。
8. **`#feng-pet-panel` 内必须有 `<footer>`**；`data-feng-pet-post` 必须是数字。
9. **各页面 `<script src>` 列表必须完全一致**，否则渐进式导航的 `compatible()` 判定失败。
10. **避免 Astro Islands** —— 会破坏 `xf:mounted` / `xf:before-unmount` 生命周期。

---

## 已知偏差

以下差异是**有意为之**或原主题自身即如此，不是移植遗漏：

| 项 | 情况 |
| :-- | :-- |
| WordPress 后台设置面板 | 不复刻。原 98KB `functions.php` 与 4 个后台 CSS/JS 改由 `src/lib/theme.ts` 承担 |
| 最近一周动态区块（`feng-activity`） | 原主题的 `template-parts/activity.php` 是**孤儿模板**（全库无人引用），上游同样不渲染。接口与渲染器已就绪，需要时挂到首页即可启用 |
| 卡片主色 `--feng-card-tone` | 依赖原主题 `.feng-cover-card` 卡片结构；本站文章列表改用 lucide bundle 的列表实现，故未启用 |
| AI 功能（`feng_ai`） | 无密钥时接口返回 501，前端显示「尚未配置」 |
| 静态 `dist/client/404.html` | 因 `/404` 改为 SSR，构建产物里不再有 `404.html`；未知路径由 Node 适配器渲染同一套 404 页面并返回 404 状态码 |
| 正文里的 `lared-grid-2/3` | 旧站导出正文带的图片网格类名，**保留原类名不重写内容**，样式在 `src/styles/global.css` 里补（山映主题无对应类） |
| 旅行足迹地图 | 原主题的 `feng-travel` 模块与 `/footprint/` 页面已移除；如需恢复见 `docs/frontend-contract.md` 的说明 |

---

## 许可与致谢

- 主题视觉与交互版权归原作者 [西风](https://xifeng.net) 所有，
  依 GPL-2.0-or-later 授权使用。
- 本移植版保留原授权声明，源码公开可见时请同步附上许可证。
