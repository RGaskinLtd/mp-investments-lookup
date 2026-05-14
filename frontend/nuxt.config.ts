export default defineNuxtConfig({
  runtimeConfig: {
    public: {
      apiBase: '',  // relative — requests go through the Nitro server route proxy
    },
  },
  css: ['~/assets/css/main.css'],
  ssr: false,
});
