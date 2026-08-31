import { useEffect, useState } from 'react'
import { API_BASE_URL } from '../api.js'

function AdminMemberRecordStub({ memberId, onNavigate }) {
  const [member, setMember] = useState(null)

  useEffect(() => {
    let cancelled = false

    fetch(`${API_BASE_URL}/api/members/${memberId}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Member not found')
        }

        return response.json()
      })
      .then((data) => {
        if (!cancelled) {
          setMember(data)
        }
      })
      .catch((error) => {
        console.error('Admin member lookup failed:', error)
        if (!cancelled) {
          setMember(null)
        }
      })

    return () => {
      cancelled = true
    }
  }, [memberId])

  return (
    <section className="admin-page">
      <button
        className="back-button"
        type="button"
        onClick={() => onNavigate('/admin/members')}
      >
        ← Back to Members
      </button>
      <div className="record-header">
        <p className="eyebrow">MEMBER RECORD</p>
        <h1>{member ? member.full_name : 'Member'}</h1>
      </div>
      <p className="admin-stub-copy">The admin member record will be available here.</p>
    </section>
  )
}

export default AdminMemberRecordStub
