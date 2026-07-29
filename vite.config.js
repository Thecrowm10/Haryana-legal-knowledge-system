import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

// pdfjs-dist 6.x only ships .mjs workers. Nginx (and most servers) won't
// serve .mjs as application/javascript, causing the worker to fail.
// This plugin copies the worker to the output directory as .js after each build.
const copyPdfWorkerAsJs = {
  name: 'copy-pdf-worker-as-js',
  writeBundle({ dir }) {
    const src = path.resolve('node_modules/pdfjs-dist/build/pdf.worker.min.mjs')
    const dest = path.join(dir || 'dist', 'pdf.worker.min.js')
    fs.copyFileSync(src, dest)
    console.log(`[copy-pdf-worker-as-js] copied → ${dest}`)
  },
}

export default defineConfig({
  plugins: [
    react(),
    copyPdfWorkerAsJs,
  ],
  // Footer "Last Updated" date — set once here at build time so it always
  // reflects the actual deploy date with no manual editing required.
  define: {
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
