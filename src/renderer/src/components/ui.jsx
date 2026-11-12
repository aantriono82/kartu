import { createContext, useCallback, useContext, useState } from 'react'
import { X } from 'lucide-react'

const ToastCtx = createContext(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const push = useCallback((message, type = 'ok') => {
    const id = Math.random()
    setItems((s) => [...s, { id, message, type }])
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), type === 'error' ? 8000 : 4000)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts">
        {items.map((t) => (
          <div key={t.id} className={'toast toast-' + t.type}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export function Modal({ title, onClose, children, footer, wide }) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={'modal' + (wide ? ' modal-wide' : '')}>
        <div className="modal-head">
          <h3>{title}</h3>
          {onClose && (
            <button className="icon-btn" onClick={onClose} title="Tutup">
              <X size={18} />
            </button>
          )}
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function Field({ label, children, hint, error }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  )
}

/** Wraps an async action: shows errors as toast, tracks busy state. */
export function useAction() {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const run = useCallback(
    async (fn, okMessage) => {
      setBusy(true)
      try {
        const r = await fn()
        if (okMessage && r !== null) toast(typeof okMessage === 'function' ? okMessage(r) : okMessage)
        return r
      } catch (e) {
        toast(e.message, 'error')
        return undefined
      } finally {
        setBusy(false)
      }
    },
    [toast]
  )
  return [run, busy]
}

export function ImportResult({ result, onClose }) {
  if (!result) return null
  return (
    <Modal title="Hasil Import" onClose={onClose} footer={<button className="btn primary" onClick={onClose}>OK</button>}>
      <p>
        <b>{result.added}</b> data baru, <b>{result.updated}</b> diperbarui
        {result.errors.length > 0 && (
          <>
            , <b className="text-danger">{result.errors.length}</b> gagal
          </>
        )}
        .
      </p>
      {result.errors.length > 0 && (
        <div className="error-list">
          {result.errors.slice(0, 200).map((e, i) => (
            <div key={i}>
              Baris {e.row}: {e.message}
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
