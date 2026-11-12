import { createRoot } from 'react-dom/client'
import '@fontsource/poppins/400.css'
import '@fontsource/poppins/500.css'
import '@fontsource/poppins/600.css'
import '@fontsource/poppins/700.css'
import '@fontsource/poppins/800.css'
import '@fontsource/roboto-condensed/400.css'
import '@fontsource/roboto-condensed/700.css'
import '@fontsource/roboto-condensed/800.css'
import '@fontsource/space-mono/400.css'
import '@fontsource/space-mono/700.css'
import '@fontsource/space-mono/700-italic.css'
import './app.css'
import App from './App'
import PrintView from './pages/PrintView'
import PngView from './pages/PngView'
import ErrorBoundary from './components/ErrorBoundary'

const FONTS = [
  '400 16px Poppins',
  '500 16px Poppins',
  '600 16px Poppins',
  '700 16px Poppins',
  '800 16px Poppins',
  '400 16px "Roboto Condensed"',
  '700 16px "Roboto Condensed"',
  '800 16px "Roboto Condensed"',
  '400 16px "Space Mono"',
  '700 16px "Space Mono"',
  'italic 700 16px "Space Mono"'
]

function route() {
  const [path, query = ''] = location.hash.replace(/^#\/?/, '').split('?')
  const params = new URLSearchParams(query)
  const job = params.get('job') ? JSON.parse(params.get('job')) : null
  // Di jendela cetak tersembunyi, error dilaporkan ke proses utama agar ekspor langsung gagal (tidak menunggu timeout).
  if (path === 'print')
    return (
      <ErrorBoundary bare onError={(e) => window.api.printReady({ error: 'Gagal merender kartu: ' + e.message })}>
        <PrintView job={job} />
      </ErrorBoundary>
    )
  if (path === 'png')
    return (
      <ErrorBoundary bare onError={(e) => window.api.pngReady({ error: 'Gagal merender kartu: ' + e.message })}>
        <PngView job={job} />
      </ErrorBoundary>
    )
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  )
}

// Font harus sudah dimuat sebelum kartu dirender, karena ukuran teks diukur saat render.
Promise.all(FONTS.map((f) => document.fonts.load(f).catch(() => {}))).finally(() => {
  document.body.classList.toggle('print-mode', /^#\/?(print|png)/.test(location.hash))
  createRoot(document.getElementById('root')).render(route())
})
