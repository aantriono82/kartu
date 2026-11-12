import { createRoot } from 'react-dom/client'
import '@fontsource/poppins/400.css'
import '@fontsource/poppins/500.css'
import '@fontsource/poppins/600.css'
import '@fontsource/poppins/700.css'
import '@fontsource/poppins/800.css'
import '@fontsource/roboto-condensed/400.css'
import '@fontsource/roboto-condensed/700.css'
import '@fontsource/roboto-condensed/800.css'
import './app.css'
import App from './App'
import PrintView from './pages/PrintView'
import PngView from './pages/PngView'

const FONTS = [
  '400 16px Poppins',
  '500 16px Poppins',
  '600 16px Poppins',
  '700 16px Poppins',
  '800 16px Poppins',
  '400 16px "Roboto Condensed"',
  '700 16px "Roboto Condensed"',
  '800 16px "Roboto Condensed"'
]

function route() {
  const [path, query = ''] = location.hash.replace(/^#\/?/, '').split('?')
  const params = new URLSearchParams(query)
  const job = params.get('job') ? JSON.parse(params.get('job')) : null
  if (path === 'print') return <PrintView job={job} />
  if (path === 'png') return <PngView job={job} />
  return <App />
}

// Font harus sudah dimuat sebelum kartu dirender, karena ukuran teks diukur saat render.
Promise.all(FONTS.map((f) => document.fonts.load(f).catch(() => {}))).finally(() => {
  document.body.classList.toggle('print-mode', /^#\/?(print|png)/.test(location.hash))
  createRoot(document.getElementById('root')).render(route())
})
