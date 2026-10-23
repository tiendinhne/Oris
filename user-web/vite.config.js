import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Trình duyệt chỉ gọi /api/<service>/...; Vite chuyển tiếp sang từng service nên không cần CORS.
// Khi có API Gateway thì trỏ tất cả về Gateway.
const url = (name, port) => process.env[`${name}_URL`] || `http://localhost:${port}`
const route = (name, port) => ({
  target: url(name, port), changeOrigin: true, rewrite: (p) => p.replace(new RegExp(`^/api/${name.toLowerCase()}`), ''),
})

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    watch: { usePolling: true }, // usePolling: Docker trên Windows không báo sự kiện đổi file
    proxy: {
      '/api/auth': route('AUTH', 8001),
      '/api/post': route('POST', 8002),
      '/api/notification': route('NOTIFICATION', 8003),
      '/api/feed': route('FEED', 8004),
      '/api/search': route('SEARCH', 8005),
    },
  },
})
