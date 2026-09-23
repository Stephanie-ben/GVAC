import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

function StatusFeedback({ type, message, onClose }) {
  const onCloseRef = useRef(onClose)

  onCloseRef.current = onClose

  useEffect(() => {
    const timer = window.setTimeout(() => onCloseRef.current(), 6000)

    return () => window.clearTimeout(timer)
  }, [message])

  const handleClose = (event) => {
    event.preventDefault()
    event.stopPropagation()
    onClose()
  }

  return createPortal(
    <div className={`status-feedback ${type}`} role={type === 'success' ? 'status' : 'alert'}>
      <div className="status-feedback-card">
        <div className="status-feedback-message">{message}</div>
        <button
          type="button"
          className="status-feedback-close"
          onClick={handleClose}
          onPointerDown={(event) => event.stopPropagation()}
          aria-label="Close"
        >
          <X size={18} strokeWidth={1.8} aria-hidden="true" />
        </button>
      </div>
    </div>,
    document.getElementById('root') || document.body
  )
}

export default StatusFeedback
