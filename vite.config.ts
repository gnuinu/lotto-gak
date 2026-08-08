import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages: https://<user>.github.io/lotto-gak/
export default defineConfig({
  base: '/lotto-gak/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: '당첨각',
        short_name: '당첨각',
        description: '로또 6/45 번호 생성기 — 오프라인에서도 동작합니다',
        lang: 'ko',
        theme_color: '#0E1420',
        background_color: '#0E1420',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/lotto-gak/',
        scope: '/lotto-gak/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // 정적 전용 앱이므로 빌드 산출물 전체를 프리캐시한다.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: '/lotto-gak/index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
