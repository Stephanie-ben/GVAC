import { useEffect, useState } from 'react'
import AdminShell from './AdminShell.jsx'
import AdminDashboard from './AdminDashboard.jsx'
import AdminMemberRecordStub from './AdminMemberRecordStub.jsx'
import AddMember from './AddMember.jsx'
import AdminLogin from './AdminLogin.jsx'
import { adminFetch } from './adminApi.js'

function AdminApp({ path, onNavigate }) {
  const [session, setSession] = useState(null)
  const [sessionChecked, setSessionChecked] = useState(false)
  const pathOnly = path.split('?')[0]
  const memberRecordMatch = pathOnly.match(/^\/admin\/members\/([^/]+)$/)

  useEffect(() => {
    let cancelled = false

    adminFetch('/api/admin/session')
      .then((response) => (response.ok ? response.json() : { authenticated: false }))
      .then((data) => {
        if (!cancelled) {
          setSession(data.authenticated ? { role: data.role } : null)
          setSessionChecked(true)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSession(null)
          setSessionChecked(true)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const onExpired = () => setSession(null)
    window.addEventListener('admin-session-expired', onExpired)
    return () => window.removeEventListener('admin-session-expired', onExpired)
  }, [])

  useEffect(() => {
    if (!session) return undefined

    let cancelled = false
    adminFetch('/api/admin/session')
      .then((response) => {
        if (!cancelled && !response.ok) {
          setSession(null)
        }
      })
      .catch(() => {
        if (!cancelled) setSession(null)
      })

    return () => {
      cancelled = true
    }
  }, [path, session])

  const handleLogout = async () => {
    try {
      await adminFetch('/api/admin/logout', { method: 'POST' })
    } catch (error) {
      console.error('Admin logout failed:', error)
    }
    setSession(null)
  }

  if (!sessionChecked) {
    return (
      <AdminShell>
        <p className="admin-stub-copy">Loading…</p>
      </AdminShell>
    )
  }

  if (!session) {
    return <AdminLogin onLoggedIn={(data) => setSession({ role: data.role })} />
  }

  const shell = {
    role: session.role,
    onLogout: handleLogout,
  }

  if (pathOnly === '/admin/add-member') {
    return (
      <AdminShell {...shell}>
        <AddMember onNavigate={onNavigate} />
      </AdminShell>
    )
  }

  if (memberRecordMatch) {
    return (
      <AdminShell {...shell}>
        <AdminMemberRecordStub
          memberId={memberRecordMatch[1]}
          onNavigate={onNavigate}
        />
      </AdminShell>
    )
  }

  return (
    <AdminShell {...shell}>
      <AdminDashboard path={path} onNavigate={onNavigate} />
    </AdminShell>
  )
}

export default AdminApp
