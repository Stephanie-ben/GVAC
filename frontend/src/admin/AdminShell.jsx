function AdminShell({ children }) {
  return (
    <div className="app admin-app">
      <header className="admin-shell-header">
        <p className="admin-shell-brand">GVAC Admin</p>
        <p className="zone-title admin-zone-title">
          <span>GVAC</span>
          <span>LAGOS ZONE</span>
        </p>
      </header>
      <main className="admin-shell-main">{children}</main>
    </div>
  )
}

export default AdminShell
