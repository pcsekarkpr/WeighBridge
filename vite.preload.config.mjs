import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      external: [
        'serialport',
        '@serialport/bindings-cpp'
      ]
    }
  }
});