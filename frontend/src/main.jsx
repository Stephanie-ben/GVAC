import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import AdminApp from './admin/AdminApp.jsx'

function currentLocation() {
  return window.location.pathname + window.location.search
}

function Root() {
  const [path, setPath] = useState(() => currentLocation())

  useEffect(() => {
    const sync = () => setPath(currentLocation())
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])

  const navigate = (to) => {
    window.history.pushState({}, '', to)
    setPath(to)
  }

  if (path.startsWith('/admin')) {
    return <AdminApp path={path} onNavigate={navigate} />
  }

  return <App />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
