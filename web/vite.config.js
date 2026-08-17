import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ['ram-chat-web.onrender.com']
  },
  preview: {
    allowedHosts: ['ram-chat-web.onrender.com']
  }
});
