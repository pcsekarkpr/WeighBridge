import { defineConfig } from 'vite';
// If you use vite-plugin-electron, import it here

export default defineConfig({
  server: {
    watch: {
      // Ignore WhatsApp authentication and cache folders from file watching
      ignored: ['**/.wwebjs_auth/**', '**/.wwebjs_cache/**'],
    },
  },
  build: {
    rollupOptions: {
      // Tell Vite absolutely NOT to bundle serialport or its C++ components
      external: [
        'serialport',
        '@serialport/bindings-cpp',
        'whatsapp-web.js',
        'puppeteer',
        'puppeteer-core',
        'qrcode'
      ] 
    }
  }
});