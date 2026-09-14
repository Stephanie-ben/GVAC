import { useEffect, useRef, useState } from 'react'
import { ChevronDown, CircleUser, LogOut } from 'lucide-react'

function isMobileAdminHeader() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 520px)').matches
}

function AdminShell({ children, role, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return undefined

    const onPointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false)
      }
    }

    const onKeyDown = (event) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  const handleTriggerClick = () => {
    if (!isMobileAdminHeader()) return
    setMenuOpen((open) => !open)
  }

  const handleLogout = () => {
    setMenuOpen(false)
    onLogout()
  }

  return (
    <div className="app admin-app">
      <header className="admin-shell-header">
        <p className="admin-shell-brand">GVAC Admin</p>
        <p className="zone-title admin-zone-title">
          <span>GVAC</span>
          <span>LAGOS ZONE</span>
        </p>
        {role && onLogout ? (
          <div className="admin-shell-session" ref={menuRef}>
            <button
              className="admin-profile-trigger"
              type="button"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Account menu"
              onClick={handleTriggerClick}
            >
              <span className="admin-profile-icon overview-icon blue">
                <CircleUser size={24} strokeWidth={2} aria-hidden="true" />
              </span>
              <ChevronDown className="admin-profile-chevron" size={16} strokeWidth={2} aria-hidden="true" />
            </button>
            <p className="admin-shell-role">{role}</p>
            <span className="admin-shell-separator" aria-hidden="true">|</span>
            <button className="admin-logout-button admin-logout-desktop" type="button" onClick={handleLogout}>
              Log out
              <LogOut size={16} strokeWidth={2} aria-hidden="true" />
            </button>
            {menuOpen ? (
              <div className="admin-profile-menu" role="menu">
                <p className="admin-profile-menu-role">{role}</p>
                <button
                  className="admin-logout-button"
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                >
                  Log out
                  <LogOut size={16} strokeWidth={2} aria-hidden="true" />
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </header>
      <main className="admin-shell-main">{children}</main>
    </div>
  )
}

export default AdminShell
