import { API_BASE_URL } from '../api.js'

export function adminFetch(path, options = {}) {
  const headers = { ...(options.headers || {}) }

  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }

  return fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers,
  }).then((response) => {
    if (
      response.status === 401 &&
      path !== '/api/admin/login' &&
      path !== '/api/admin/session'
    ) {
      window.dispatchEvent(new Event('admin-session-expired'))
    }

    return response
  })
}
