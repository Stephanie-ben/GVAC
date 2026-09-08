import { useEffect, useState } from 'react'
import { Users, Banknote, CalendarDays } from 'lucide-react'
import { API_BASE_URL } from '../api.js'

function OverviewCards() {
  const [committedMembers, setCommittedMembers] = useState(null)

  useEffect(() => {
    let cancelled = false

    fetch(`${API_BASE_URL}/api/admin/dashboard`)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to load member count')
        }

        return response.json()
      })
      .then((data) => {
        if (!cancelled) {
          setCommittedMembers(data.financially_committed_members)
        }
      })
      .catch((error) => {
        console.error('Member overview lookup failed:', error)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="overview-grid">
    <div className="overview-card financially-committed-card">
      <div className="overview-icon blue">
        <Users size={24} strokeWidth={2} />
      </div>
      <strong>{committedMembers == null ? '' : Number(committedMembers).toLocaleString()}</strong>
      <span>Financially committed members</span>
    </div>

    <div className="overview-card overview-secondary-card">
      <div className="overview-icon green">
        <Banknote size={24} strokeWidth={2} />
      </div>
      <strong>₦500</strong>
      <span>Monthly dues</span>
    </div>

    <div className="overview-card overview-secondary-card">
      <div className="overview-icon purple">
        <CalendarDays size={24} strokeWidth={2} />
      </div>
      <strong>2018</strong>
      <span>Dues tracking begins</span>
    </div>
  </div>
  )
}

export default OverviewCards
