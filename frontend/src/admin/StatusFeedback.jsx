import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

function StatusFeedback({ type, message, onClose }) {
  const isSuccess = type === 'success'
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!isSuccess || typeof window === 'undefined') return
    if (window.matchMedia('(max-width: 520px)').matches) return

    const timer = window.setTimeout(() => onCloseRef.current(), 4500)
    return () => window.clearTimeout(timer)
  }, [isSuccess, message])

  const handleClose = (event) => {
    event.preventDefault()
    event.stopPropagation()
    onClose()
  }

  return createPortal(
    <div className={`status-feedback ${type}`} role={isSuccess ? 'status' : 'alert'}>
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
