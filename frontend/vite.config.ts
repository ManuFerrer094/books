import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const envDir = fileURLToPath(new URL('../', import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, '');
  const onVercel = process.env.VERCEL === '1';
  return {
    envDir,
    plugins: [react()],
    server: {
      port: Number(process.env.PORT) || 5173,
      // vercel dev handles /api through the service route table.
      // Only standalone Vite needs a proxy to standalone Nest.
      proxy: onVercel
        ? undefined
        : {
            '/api': {
              target: env.API_PROXY_TARGET || 'http://localhost:3000',
              changeOrigin: true,
              rewrite: (path) => path.replace(/^\/api/, ''),
            },
          },
    },
  };
});
