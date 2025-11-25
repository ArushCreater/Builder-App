import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../shared/src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://awseb-e-7-AWSEBLoa-8SHHN7GS1RDA-389774250.ap-southeast-2.elb.amazonaws.com',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
