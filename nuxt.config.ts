// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  // SPA mode: this is a client-heavy, session/localStorage-driven dispatch
  // simulation with no SEO surface, and SSR hydration was fighting the
  // Leaflet map (window-dependent) and ClientOnly boundaries. Nitro
  // server/api/* routes are unaffected by this and still run normally.
  ssr: false,

  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@pinia/nuxt',
    'pinia-plugin-persistedstate/nuxt'
  ],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  piniaPluginPersistedstate: {
    storage: 'localStorage'
  },

  components: [
    { path: '~/components', pathPrefix: false }
  ],

  runtimeConfig: {
    anthropicApiKey: '',
    orsApiKey: '',
    public: {}
  },

  compatibilityDate: '2026-06-30',

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
