import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // 127.0.0.1, not "localhost": on Linux that can resolve to ::1 only, and the
    // browser tests wait on 127.0.0.1 (CI run 36320461208 timed out that way).
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:3001' },
  },
});
