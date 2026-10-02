import { defineConfig } from 'vite';
export default defineConfig({
  base: '/jpeg-converter-web/',
  worker: { format: 'es' },
  build: { assetsInlineLimit: 0 },
  plugins: [{
    name: 'local-development-csp',
    transformIndexHtml(html, context) {
      if (!context.server) return html;
      // Only the developer's local Vite server permits its CSS injection and HMR.
      // Production builds retain the original strict same-origin CSP.
      return html.replace("style-src 'self'", "style-src 'self' 'unsafe-inline'")
        .replace("connect-src 'self'", "connect-src 'self' ws://127.0.0.1:* ws://localhost:*");
    },
  }],
});
