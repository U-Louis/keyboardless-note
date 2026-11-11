import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    {
      name: 'talk',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const path = req.url?.split('?')[0]
          if (path !== '/api/talk') {
            next()
            return
          }
          if (req.method !== 'POST') {
            res.statusCode = 405
            res.end()
            return
          }
          const { respondToTalk } = await import('./src/talk/respondToTalk')
          const result = await respondToTalk(req)
          res.statusCode = result.status
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify(result.body))
        })
      },
    },
  ],
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
