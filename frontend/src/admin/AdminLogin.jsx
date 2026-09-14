import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import AdminShell from './AdminShell.jsx'
import { adminFetch } from './adminApi.js'

function AdminLogin({ onLoggedIn }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (saving) return

    setError(null)
    setSaving(true)
    try {
      const response = await adminFetch('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || 'Invalid username or password.')
      }
      onLoggedIn(data)
    } catch (loginError) {
      setError(loginError.message || 'Invalid username or password.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminShell>
      <section className="admin-page admin-login-page">
        <h1>Admin login</h1>
        <p className="admin-login-copy">
          Sign in to manage members and record payments
        </p>

        <form className="add-member-card admin-login-card" onSubmit={handleSubmit}>
          <label className="payment-detail-field" htmlFor="admin-username">
            <span>Username</span>
            <input
              id="admin-username"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck="false"
            />
          </label>
          <label className="payment-detail-field" htmlFor="admin-password">
            <span>Password</span>
            <span className="admin-password-field">
              <input
                id="admin-password"
                type={passwordVisible ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
              />
              <button
                className="admin-password-toggle"
                type="button"
                aria-label={passwordVisible ? 'Hide password' : 'Show password'}
                onClick={() => setPasswordVisible((visible) => !visible)}
              >
                {passwordVisible ? (
                  <EyeOff size={18} strokeWidth={2} aria-hidden="true" />
                ) : (
                  <Eye size={18} strokeWidth={2} aria-hidden="true" />
                )}
              </button>
            </span>
          </label>
          {error && <p className="payment-preview-error" role="alert">{error}</p>}
          <button className="admin-add-member admin-login-submit" type="submit" disabled={saving}>
            {saving ? 'Signing in…' : 'Log in'}
          </button>
        </form>
      </section>
    </AdminShell>
  )
}

export default AdminLogin
