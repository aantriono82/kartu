import { useCallback, useEffect, useState } from 'react'
import { IdCard, Users, Settings as SettingsIcon, DatabaseBackup } from 'lucide-react'
import { ToastProvider } from './components/ui'
import ErrorBoundary from './components/ErrorBoundary'
import Exams from './pages/Exams'
import Students from './pages/Students'
import Settings from './pages/Settings'
import Backup from './pages/Backup'

const NAV = [
  ['exams', 'Ujian & Cetak', IdCard],
  ['students', 'Data Siswa', Users],
  ['settings', 'Pengaturan Sekolah', SettingsIcon],
  ['backup', 'Backup & Restore', DatabaseBackup]
]

export default function App() {
  const [page, setPage] = useState('exams')
  const [settings, setSettings] = useState(null)
  const reloadSettings = useCallback(
    () =>
      window.api.getSettings().then((s) => {
        setSettings(s)
        // instalasi baru (data sekolah belum diisi): langsung buka Pengaturan Sekolah
        setPage((p) => (p === 'exams' && !s.namaSekolah?.trim() ? 'settings' : p))
      }),
    []
  )
  useEffect(() => {
    reloadSettings()
  }, [reloadSettings])

  if (!settings) return null
  return (
    <ToastProvider>
      <div className="layout">
        <aside className="sidebar">
          <div className="brand">
            <IdCard size={26} />
            <div>
              <b>Kartu Ujian</b>
              <small>{settings.namaSekolah || 'Sekolah belum diatur'}</small>
            </div>
          </div>
          {NAV.map(([key, label, Icon]) => (
            <button key={key} className={'nav' + (page === key ? ' active' : '')} onClick={() => setPage(key)}>
              <Icon size={18} /> {label}
            </button>
          ))}
        </aside>
        <main className="content">
          <ErrorBoundary key={page}>
            {page === 'exams' && <Exams settings={settings} />}
            {page === 'students' && <Students />}
            {page === 'settings' && <Settings settings={settings} onChange={setSettings} />}
            {page === 'backup' && <Backup onRestored={() => location.reload()} />}
          </ErrorBoundary>
        </main>
      </div>
    </ToastProvider>
  )
}
