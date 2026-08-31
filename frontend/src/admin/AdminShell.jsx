function AdminShell({ path, onNavigate, children }) {
  const membersActive = path.startsWith('/admin/members')
  const dashboardActive = !membersActive

  return (
    <div className="app admin-app">
      <header className="admin-shell-header">
        <p className="admin-shell-brand">GVAC Admin</p>
        <nav className="admin-shell-nav" aria-label="Admin">
          <a
            className={`admin-nav-link${dashboardActive ? ' active' : ''}`}
            href="/admin"
            onClick={(event) => {
              event.preventDefault()
              onNavigate('/admin')
            }}
          >
            Dashboard
          </a>
          <a
            className={`admin-nav-link${membersActive ? ' active' : ''}`}
            href="/admin/members"
            onClick={(event) => {
              event.preventDefault()
              onNavigate('/admin/members')
            }}
          >
            Members
          </a>
        </nav>
      </header>
      <main className="admin-shell-main">{children}</main>
    </div>
  )
}

export default AdminShell
