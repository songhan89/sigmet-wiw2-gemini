import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const maptilerApi = env.MAPTILER_API || env.VITE_MAPTILER_API || '';

  return {
    base: './',
    plugins: [react()],
    define: {
      'import.meta.env.VITE_MAPTILER_API': JSON.stringify(maptilerApi),
      'import.meta.env.MAPTILER_API': JSON.stringify(maptilerApi),
    },
    server: {
      port: 5173,
      host: true,
    }
  };
});
