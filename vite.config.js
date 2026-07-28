import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Nginx (and some other servers) don't serve .mjs with application/javascript,
// causing the PDF.js worker to fail with a MIME type error.
// This plugin renames all .mjs output assets to .js and updates the URL
// references in the bundle so the app still finds the renamed file.
const renameMjsToJs = {
  name: 'rename-mjs-to-js',
  generateBundle(_, bundle) {
    const renamed = {}
    for (const key of Object.keys(bundle)) {
      if (key.endsWith('.mjs')) {
        const newKey = key.slice(0, -4) + '.js'
        const chunk = bundle[key]
        chunk.fileName = newKey
        bundle[newKey] = chunk
        delete bundle[key]
        renamed[key.split('/').pop()] = newKey.split('/').pop()
      }
    }
    // Patch URL string references inside JS chunks
    for (const chunk of Object.values(bundle)) {
      if (chunk.type === 'chunk' && typeof chunk.code === 'string') {
        for (const [oldName, newName] of Object.entries(renamed)) {
          chunk.code = chunk.code.replaceAll(oldName, newName)
        }
      }
    }
  },
}

export default defineConfig({
  plugins: [
    react(),
    renameMjsToJs,
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
