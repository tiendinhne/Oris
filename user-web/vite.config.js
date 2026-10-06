import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Chưa có API phía người dùng nên chưa cần proxy; thêm khi backend có.
export default defineConfig({
  plugins: [react()],
  server: { port: 5174, watch: { usePolling: true } }, // usePolling: Docker trên Windows không báo sự kiện đổi file
})
