// @ts-check
import { defineConfig } from 'astro/config'

import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'
import node from '@astrojs/node'

import { SITE } from './src/config/site.ts'

// https://astro.build/config
export default defineConfig({
  site: SITE.url,
  // 页面走 SSG；需要动态数据的路由在文件内 `export const prerender = false`。
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  integrations: [mdx(), sitemap()],
  // 站内链接同时存在带斜杠（WordPress 风格）与不带斜杠（Astro 风格）两种写法，
  // 这里不做重定向，两种都能正常访问。
  trailingSlash: 'ignore',
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
