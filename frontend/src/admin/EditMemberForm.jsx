import { useMemo, useState } from 'react'
import StatusFeedback from './StatusFeedback.jsx'
import { adminFetch } from './adminApi.js'
import { CoverageDateFields, paidYears } from './PaymentCoveragePreview.jsx'

function periodFromApi(value) {
  const raw = String(value || '')
  const day = raw.slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(day)) return `${day.slice(0, 7)}-01`
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-01`
}

function EditMemberForm({ memberId, memberName, duesStartMonth, onSaved }) {
  const years = useMemo(() => paidYears(), [])
  const [fullName, setFullName] = useState(memberName || '')
  const [startMonth, setStartMonth] = useState(periodFromApi(duesStartMonth))
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState(null)

  const canSave = Boolean(fullName.trim() && /^\d{4}-\d{2}-01$/.test(startMonth) && !saving)

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    setFeedback(null)
    try {
      const response = await adminFetch(`/api/admin/members/${memberId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          full_name: fullName.trim(),
          dues_start_month: startMonth,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Member could not be updated.')
      const savedName = data.full_name || fullName.trim()
      setFeedback({ type: 'success', message: `${savedName} has been updated successfully.` })
      onSaved?.()
    } catch {
      setFeedback({ type: 'error', message: 'Member could not be updated. Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="payment-record-flow">
      <section className="payment-management-card">
        <div className="edit-member-heading">
          <div className="section-heading">
            <p className="eyebrow">EDIT MEMBER</p>
          </div>
          <button className="record-edit-button" type="button" onClick={handleSave} disabled={!canSave}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
        <label className="payment-detail-field" htmlFor="edit-full-name">
          <span>Full Name</span>
          <input
            id="edit-full-name"
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            autoComplete="off"
          />
        </label>
        <div className="add-member-dues-start">
          <CoverageDateFields
            label="Dues Start Month"
            period={startMonth}
            years={years}
            onChange={setStartMonth}
          />
        </div>
      </section>
      {feedback && (
        <StatusFeedback
          type={feedback.type}
          message={feedback.message}
          onClose={() => setFeedback(null)}
        />
      )}
    </div>
  )
}

export default EditMemberForm
