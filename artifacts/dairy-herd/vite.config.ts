import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

// PORT and BASE_PATH are required for the Replit dev server but not for
// production builds (e.g. Netlify). Only enforce them in dev mode.
const isBuild =
  process.env.npm_lifecycle_event === 'build' ||
  process.argv.some((a) => a === 'build');

const rawPort = process.env.PORT;
if (!rawPort && !isBuild) {
  throw new Error(
    'PORT environment variable is required but was not provided.',
  );
}
const port = rawPort ? Number(rawPort) : 3000;
if (!isBuild && (Number.isNaN(port) || port <= 0)) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;
if (!basePath && !isBuild) {
  throw new Error(
    'BASE_PATH environment variable is required but was not provided.',
  );
}
const effectiveBasePath = basePath ?? '/';

export default defineConfig({
  base: effectiveBasePath,
  define: {
    // Injected at build time so the UI can show which code version is running.
    __BUILD_TS__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Dairy Herd Manager',
        short_name: 'DairyHerd',
        description: 'Herd management for dairy farmers',
        theme_color: '#2d5016',
        background_color: '#f8f5f0',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          { urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i, handler: 'CacheFirst' }
        ]
      }
    }),
    ...(process.env.NODE_ENV !== 'production' &&
    process.env.REPL_ID !== undefined
      ? [
          await import('@replit/vite-plugin-cartographer').then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, '..'),
            }),
          ),
          await import('@replit/vite-plugin-dev-banner').then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
