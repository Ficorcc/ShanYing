// @ts-check
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'astro/config'

import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'
import node from '@astrojs/node'
import cloudflare from '@astrojs/cloudflare'

import { SITE } from './src/config/site.ts'

/**
 * 目标平台。
 *
 * - `cloudflare`：产物是 Workers 形态，静态资源与 Worker 同在 dist/，
 *   交给 `wrangler pages deploy dist`（Pages）或 `wrangler deploy`（Workers）。
 *   Cloudflare Pages 的构建环境会自动带上 CF_PAGES=1，无需额外配置。
 * - `node`：产物是 dist/client + dist/server（standalone），
 *   用于本地开发调试，或部署到自己的 Node 服务器。
 *
 * 本地开发时可以用 `SHANYING_PLATFORM=node npm run dev` 走 Node 运行时。
 */
const platform =
  process.env.SHANYING_PLATFORM ?? (process.env.CF_PAGES ? 'cloudflare' : 'node')

const isCloudflare = platform === 'cloudflare'

// 运行期数据的落盘后端随平台切换：Node 用 var/store.json，Cloudflare 用 KV
const storeBackend = fileURLToPath(
  new URL(
    isCloudflare ? './src/lib/store/backend.cloudflare.ts' : './src/lib/store/backend.node.ts',
    import.meta.url,
  ),
)

// https://astro.build/config
export default defineConfig({
  site: SITE.url,
  // 页面走 SSG；需要动态数据的路由在文件内 `export const prerender = false`。
  output: 'static',
  adapter: isCloudflare ? cloudflare({ imageService: 'passthrough' }) : node({ mode: 'standalone' }),
  integrations: [mdx(), sitemap()],
  // 站内链接同时存在带斜杠（WordPress 风格）与不带斜杠（Astro 风格）两种写法，
  // 这里不做重定向，两种都能正常访问。
  trailingSlash: 'ignore',
  vite: {
    resolve: {
      alias: {
        '@shanying/store-backend': storeBackend,
      },
    },
  },
  markdown: {
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark-dimmed',
      },
      defaultColor: false,
      wrap: true,
    },
  },
})
