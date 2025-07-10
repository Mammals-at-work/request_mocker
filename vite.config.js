import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  root: 'frontend',
  build: {
// ...existing code...
    outDir: '../dist/frontend',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      'vue': 'vue/dist/vue.esm-bundler.js',
    },
  },
  plugins: [vue()],
})
