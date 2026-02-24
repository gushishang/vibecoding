import vue from '@vitejs/plugin-vue'
import { ProxyAgent } from 'proxy-agent'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      vue({
        features: {
          vapor: true,
        },
      }),
    ],
    server: {
      proxy: {
        '/plapi': {
          target: 'https://physics-api-cn.turtlesim.com',
          changeOrigin: true,
          secure: false,
          agent: new ProxyAgent(),
          rewrite: (path) => path.replace(/^\/plapi/, ''),
          configure: (proxy) => {
            proxy.on('error', (err) => {
              console.error('[PLAPI proxy error]', err)
            })
          },
        },
        '/plimg': {
          target: 'https://physics-lab.oss-cn-hongkong.aliyuncs.com',
          changeOrigin: true,
          secure: false,
          agent: new ProxyAgent(),
          rewrite: (path) => path.replace(/^\/plimg/, ''),
        },
        '/upyun': {
          target: 'http://v0.api.upyun.com',
          changeOrigin: true,
          secure: false,
          agent: new ProxyAgent(),
          rewrite: () => '/qphysics',
        },
      },
    },
    define: {
      __APP_USERNAME__: JSON.stringify(env.VITE_PL_USERNAME || ''),
      __APP_PASSWORD__: JSON.stringify(env.VITE_PL_PASSWORD || ''),
    },
    test: {
      environment: 'jsdom',
    },
  }
})
