import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { I18nextProvider } from 'react-i18next'
import './index.css'
import i18n from './i18n'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

// pdfjs-dist 6.x calls Promise.withResolvers() internally (pdf.mjs), a
// runtime method only available in very recent browsers (Chrome 119+,
// Firefox 121+, Safari 17.4+). Older/unsupported browsers throw
// "Promise.withResolvers is not a function" the moment the PDF viewer
// (DocViewModal) loads, crashing to the ErrorBoundary. Polyfilling it here,
// before any other module runs, covers every caller.
if (typeof Promise.withResolvers !== 'function') {
  Promise.withResolvers = function withResolvers() {
    let resolve, reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
  };
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>
    </ErrorBoundary>
  </StrictMode>,
)
