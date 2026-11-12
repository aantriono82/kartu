import { Component } from 'react'

/** Menampilkan pesan + tombol muat ulang alih-alih layar putih saat komponen error. */
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Render error', error, info?.componentStack)
    this.props.onError?.(error)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    if (this.props.bare) return <div>{String(error.message || error)}</div>
    return (
      <div className="crash">
        <h1>Terjadi kesalahan</h1>
        <p>Tampilan aplikasi mengalami error. Data Anda tetap tersimpan aman. Klik tombol di bawah untuk memuat ulang.</p>
        <pre className="crash-detail">{String(error.stack || error.message || error)}</pre>
        <div className="row gap-s">
          <button className="btn primary" onClick={() => location.reload()}>
            Muat Ulang
          </button>
          <button className="btn ghost" onClick={() => this.setState({ error: null })}>
            Coba Lanjutkan
          </button>
        </div>
      </div>
    )
  }
}
