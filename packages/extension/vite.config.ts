import { defineConfig, loadEnv, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import basicSsl from '@vitejs/plugin-basic-ssl'

// 从环境变量读取需要放行的自定义网关域名，构建时注入 manifest.host_permissions。
// 用法: EXTENSION_EXTRA_HOSTS="https://myl.ccwu.cc/*,https://api.example.com/*" pnpm build:ext
// 支持通过扩展包目录下的 .env 文件配置（loadEnv 会一并读取）。
function injectManifestHostPermissions(extraHosts: string[]): Plugin {
  return {
    name: 'inject-manifest-host-permissions',
    closeBundle() {
      const manifestPath = resolve(__dirname, 'dist', 'manifest.json')
      if (extraHosts.length === 0 || !existsSync(manifestPath)) return
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
      const merged = [...(manifest.host_permissions ?? []), ...extraHosts]
      manifest.host_permissions = Array.from(new Set(merged))
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8')
      console.log(`[extension] injected host_permissions: ${manifest.host_permissions.join(', ')}`)
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = { ...process.env, ...loadEnv(mode, __dirname, '') }
  const extraHosts = (env.EXTENSION_EXTRA_HOSTS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  return {
    plugins: [vue(), basicSsl(), extraHosts.length ? injectManifestHostPermissions(extraHosts) : null],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        '@prompt-optimizer/ui': resolve(__dirname, '../ui')
      },
    },
    base: './',  // 使用相对路径
    build: {
      outDir: 'dist',
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'index.html')
      },
      output: {
        entryFileNames: `assets/[name].js`,
        chunkFileNames: `assets/[name].js`,
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'background.js') {
            return 'background.js';
          }
          return `assets/[name].[ext]`;
        }
      }
    },
    copyPublicDir: true
  },
  server: {
    port: 5174,
    https: {}
  }
  }
})
