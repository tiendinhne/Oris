import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Trình duyệt chỉ gọi cùng một địa chỉ (/api/...), Vite chuyển tiếp sang từng service.
// Nhờ vậy không cần cấu hình CORS. Khi có API Gateway thì trỏ cả hai về Gateway.
const AUTH_URL = process.env.AUTH_URL || 'http://localhost:8001'
const POST_URL = process.env.POST_URL || 'http://localhost:8002'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api/auth': { target: AUTH_URL, changeOrigin: true, rewrite: (p) => p.replace(/^\/api\/auth/, '') },
      '/api/post': { target: POST_URL, changeOrigin: true, rewrite: (p) => p.replace(/^\/api\/post/, '') },
    },
  },
})
