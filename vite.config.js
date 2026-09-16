import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

// pdfjs-dist 6.x only ships .mjs workers. Nginx (and most servers) won't
// serve .mjs as application/javascript, causing the worker to fail.
// This plugin copies the worker to the output directory as .js after each build.
//
// It also prepends a Promise.withResolvers polyfill: the worker (like the
// main pdfjs-dist bundle) calls this ES2024 runtime method internally, and a
// Worker has its own isolated global scope — polyfilling it on the main
// thread (src/main.jsx) has no effect here. Without this, browsers lacking
// native support (pre Chrome 119 / Firefox 121 / Safari 17.4) crash inside
// the worker instead, mid-render, even after the main-thread crash is fixed.
const PROMISE_WITH_RESOLVERS_POLYFILL = `if(typeof Promise.withResolvers!=="function"){Promise.withResolvers=function(){let resolve,reject;const promise=new Promise((res,rej)=>{resolve=res;reject=rej});return{promise,resolve,reject}}}\n`
const copyPdfWorkerAsJs = {
  name: 'copy-pdf-worker-as-js',
  writeBundle({ dir }) {
    const src = path.resolve('node_modules/pdfjs-dist/build/pdf.worker.min.mjs')
    const dest = path.join(dir || 'dist', 'pdf.worker.min.js')
    const workerSrc = fs.readFileSync(src, 'utf8')
    fs.writeFileSync(dest, PROMISE_WITH_RESOLVERS_POLYFILL + workerSrc)
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
