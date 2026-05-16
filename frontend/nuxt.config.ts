export default defineNuxtConfig({
  runtimeConfig: {
    public: {
      apiBase: '',  // relative — Nitro handles /api/* directly on Vercel; proxied to Express in Docker
    },
  },
  css: ['~/assets/css/main.css'],
  ssr: false,
  nitro: {
    // Vercel preset is auto-detected; explicit here for clarity
    preset: process.env.VERCEL ? 'vercel' : undefined,
  },
});
