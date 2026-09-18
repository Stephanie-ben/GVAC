import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { API_BASE_URL } from '../api.js'
import { namesMatch } from './memberName.js'
import StatusFeedback from './StatusFeedback.jsx'
import { adminFetch } from './adminApi.js'

function portalRoot() {
  return document.getElementById('root') || document.body
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MONTHLY_DUES_NGN = 500
const EXCLUDED_YEAR = 2020

function pad2(value) {
  return String(value).padStart(2, '0')
}

function currentMonthPeriod() {
  const now = new Date()
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-01`
}

function todayIsoDate() {
  const now = new Date()
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
}

function paidYears() {
  const years = []
  for (let year = 2018; year <= 2028; year += 1) years.push(year)
  return years
}

function coverageYears(extraYears = []) {
  const extras = extraYears.map(Number).filter((year) => year > 0)
  const maxYear = Math.max(2028, new Date().getFullYear(), ...extras)
  const years = []
  for (let year = 2018; year <= maxYear; year += 1) {
    if (year !== EXCLUDED_YEAR) years.push(year)
  }
  return years
}

function splitPeriod(period) {
  const [year = '', month = ''] = (period || '').split('-')
  return { year, month }
}

function buildPeriod(year, month) {
  return year && month ? `${year}-${pad2(month)}-01` : ''
}

function formatMonthYear(period) {
  const { year, month } = splitPeriod(period)
  if (!year || !month) return ''
  return `${MONTHS[Number(month) - 1]} ${year}`
}

function formatPaidDate(isoDate) {
  const [year, month, day] = (isoDate || '').split('-').map(Number)
  if (!year || !month || !day) return ''
  return `${day} ${MONTHS[month - 1]} ${year}`
}

function splitPaidDate(isoDate) {
  const [year = '', month = '', day = ''] = (isoDate || '').split('-')
  return { year, month, day }
}

function buildPaidDate(year, month, day) {
  if (!year && !month && !day) return ''
  return `${year}-${pad2(month)}-${pad2(day)}`
}

function daysInMonth(year, month) {
  if (!year || !month) return 31
  return new Date(Number(year), Number(month), 0).getDate()
}

function nextApplicableMonth(year, month) {
  let nextYear = year
  let nextMonth = month + 1
  if (nextMonth > 12) {
    nextMonth = 1
    nextYear += 1
  }
  if (nextYear === EXCLUDED_YEAR) {
    return { year: EXCLUDED_YEAR + 1, month: 1 }
  }
  return { year: nextYear, month: nextMonth }
}

function coverageEndFromStart(startPeriod, monthCount) {
  if (!startPeriod || !monthCount) return ''
  let year = Number(startPeriod.slice(0, 4))
  let month = Number(startPeriod.slice(5, 7))
  if (!year || !month) return ''
  if (year === EXCLUDED_YEAR) {
    year = EXCLUDED_YEAR + 1
    month = 1
  }

  let covered = 1
  while (covered < monthCount) {
    const next = nextApplicableMonth(year, month)
    year = next.year
    month = next.month
    covered += 1
  }

  return `${year}-${pad2(month)}-01`
}

function clampPaidDay(year, month, day) {
  const max = daysInMonth(year, month)
  const value = Number(day)
  if (!value) return day
  return pad2(Math.min(value, max))
}

function PaidDateFields({ label, date, years, onChange }) {
  const { year, month, day } = splitPaidDate(date)
  const dayCount = daysInMonth(year, month)

  return (
    <fieldset className="coverage-date-fields paid-date-fields">
      <legend>{label}</legend>
      <label>
        <span>Day</span>
        <select value={day} onChange={(event) => onChange(buildPaidDate(year, month, event.target.value))}>
          <option value="">Select</option>
          {Array.from({ length: dayCount }, (_, index) => pad2(index + 1)).map((value) => (
            <option value={value} key={value}>{Number(value)}</option>
          ))}
        </select>
      </label>
      <label>
        <span>Month</span>
        <select value={month} onChange={(event) => onChange(buildPaidDate(year, event.target.value, clampPaidDay(year, event.target.value, day)))}>
          <option value="">Select</option>
          {MONTHS.map((name, index) => (
            <option value={pad2(index + 1)} key={name}>{name}</option>
          ))}
        </select>
      </label>
      <label>
        <span>Year</span>
        <select value={year} onChange={(event) => onChange(buildPaidDate(event.target.value, month, clampPaidDay(event.target.value, month, day)))}>
          <option value="">Select</option>
          {years.map((value) => (
            <option value={value} key={value}>{value}</option>
          ))}
        </select>
      </label>
    </fieldset>
  )
}

async function findExistingMember(firstName, lastName) {
  const queries = Array.from(new Set([
    `${firstName} ${lastName}`,
    `${lastName} ${firstName}`,
    lastName,
    firstName,
  ].filter(Boolean)))

  const responses = await Promise.all(
    queries.map((query) => fetch(`${API_BASE_URL}/api/members?search=${encodeURIComponent(query)}`))
  )
  const pages = await Promise.all(responses.map((response) => {
    if (!response.ok) throw new Error('Unable to check for an existing member.')
    return response.json()
  }))

  const members = []
  for (const page of pages) {
    const rows = Array.isArray(page) ? page : page.members || []
    members.push(...rows)
  }

  return members.find((member) => namesMatch(member.full_name, firstName, lastName)) || null
}

function CoverageDateFields({ label, period, years, onChange, disabled = false }) {
  const { year, month } = splitPeriod(period)
  return (
    <fieldset className="coverage-date-fields" disabled={disabled}>
      <legend>{label}</legend>
      <label>
        <span>Month</span>
        <select value={month} onChange={(event) => onChange(buildPeriod(year, event.target.value))}>
          <option value="">Select</option>
          {MONTHS.map((name, index) => (
            <option value={pad2(index + 1)} key={name}>{name}</option>
          ))}
        </select>
      </label>
      <label>
        <span>Year</span>
        <select value={year} onChange={(event) => onChange(buildPeriod(event.target.value, month))}>
          <option value="">Select</option>
          {years.map((value) => (
            <option value={value} key={value}>{value}</option>
          ))}
        </select>
      </label>
    </fieldset>
  )
}

function AddMember({ onNavigate }) {
  const dateYears = useMemo(() => paidYears(), [])
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [duesStart, setDuesStart] = useState(currentMonthPeriod())
  const [datePaid, setDatePaid] = useState(todayIsoDate())
  const [amount, setAmount] = useState('')
  const [coverageStart, setCoverageStart] = useState(currentMonthPeriod())
  const [confirming, setConfirming] = useState(false)
  const [existingMember, setExistingMember] = useState(null)
  const [checkingName, setCheckingName] = useState(false)
  const [lookupError, setLookupError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  const parsedAmount = Number(amount)
  const monthCount = Number.isInteger(parsedAmount) && parsedAmount > 0 && parsedAmount % MONTHLY_DUES_NGN === 0
    ? parsedAmount / MONTHLY_DUES_NGN
    : null
  const amountError = amount !== '' && monthCount === null
    ? 'The amount should clear one or more months.'
    : null
  const coverageEnd = monthCount ? coverageEndFromStart(coverageStart, monthCount) : ''
  const years = useMemo(
    () => coverageYears([coverageStart, coverageEnd].map((period) => Number((period || '').slice(0, 4)))),
    [coverageStart, coverageEnd]
  )
  const fullName = `${firstName.trim()} ${lastName.trim()}`.trim()
  const canContinue = Boolean(
    firstName.trim() &&
    lastName.trim() &&
    duesStart &&
    datePaid &&
    monthCount &&
    coverageStart &&
    coverageEnd
  )

  const handleConfirmAdd = async () => {
    if (saving) return
    setSaveError(null)
    setSaving(true)
    try {
      const response = await adminFetch('/api/admin/members', {
        method: 'POST',
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          dues_start_month: duesStart,
          payment_date: datePaid,
          amount_ngn: parsedAmount,
          coverage: { start_period: coverageStart, end_period: coverageEnd },
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Member could not be added.')
      setConfirming(false)
      onNavigate(`/admin?added=${encodeURIComponent(data.full_name || fullName)}`)
    } catch {
      setConfirming(false)
      setSaveError('Member could not be added. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleContinue = async () => {
    if (!canContinue || checkingName) return
    setLookupError(null)
    setCheckingName(true)
    try {
      const existing = await findExistingMember(firstName.trim(), lastName.trim())
      if (existing) {
        setExistingMember(existing)
      } else {
        setConfirming(true)
      }
    } catch (error) {
      setLookupError(error.message || 'Unable to check for an existing member.')
    } finally {
      setCheckingName(false)
    }
  }

  const handleDuplicateCancel = (event) => {
    event.preventDefault()
    event.stopPropagation()
    setExistingMember(null)
  }

  const handleViewExistingMember = (event) => {
    event.preventDefault()
    event.stopPropagation()
    if (!existingMember?.id) return
    onNavigate(`/admin/members/${existingMember.id}`)
  }

  return (
    <section className="admin-page add-member-page">
      <div className="sticky-back-header">
        <button className="back-button" type="button" onClick={() => onNavigate('/admin')}>
          ← Back to Home
        </button>
      </div>
      <div className="admin-dashboard-header add-member-header">
        <h1>Add Member</h1>
        <button className="admin-add-member" type="button" onClick={handleContinue}>
          Continue
        </button>
      </div>

      <section className="add-member-card">
        <div className="section-heading"><p className="eyebrow">MEMBER DETAILS</p></div>
        <div className="add-member-grid">
          <label className="payment-detail-field" htmlFor="add-first-name">
            <span>First Name</span>
            <input id="add-first-name" type="text" value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="off" />
          </label>
          <label className="payment-detail-field" htmlFor="add-last-name">
            <span>Last Name</span>
            <input id="add-last-name" type="text" value={lastName} onChange={(event) => setLastName(event.target.value)} autoComplete="off" />
          </label>
        </div>
        <div className="add-member-dues-start">
          <CoverageDateFields label="Dues Start Date" period={duesStart} years={years} onChange={setDuesStart} />
        </div>
      </section>

      <section className="add-member-card">
        <div className="section-heading"><p className="eyebrow">PAYMENT DETAILS</p></div>
        <div className="add-member-date-paid">
          <PaidDateFields label="Date paid" date={datePaid} years={dateYears} onChange={setDatePaid} />
        </div>
        <label className="payment-amount-field" htmlFor="add-payment-amount">
          <span>Amount paid</span>
          <span className="payment-amount-control">
            <span className="payment-amount-prefix">₦</span>
            <input id="add-payment-amount" inputMode="numeric" type="text" autoComplete="off" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </span>
        </label>
        {amountError && <p className="payment-preview-error" role="alert">{amountError}</p>}
      </section>

      <section className="add-member-card">
        <div className="section-heading"><p className="eyebrow">COVERAGE PREVIEW</p></div>
        <div className="add-member-coverage-grid">
          <CoverageDateFields label="Coverage Start" period={coverageStart} years={years} onChange={setCoverageStart} />
          <CoverageDateFields label="Coverage End" period={coverageEnd} years={years} onChange={() => {}} disabled />
        </div>
      </section>

      {lookupError && <p className="payment-preview-error" role="alert">{lookupError}</p>}
      {saveError && (
        <StatusFeedback
          type="error"
          message={saveError}
          onClose={() => setSaveError(null)}
        />
      )}

      {existingMember && createPortal(
        <div className="payment-confirmation-backdrop" role="presentation">
          <section
            className="payment-confirmation-modal add-member-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="existing-member-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="existing-member-title">Member already exists</h3>
            <p>A member with this name already exists.</p>
            <p>Member name: <strong>{existingMember.full_name}</strong></p>
            <div className="confirmation-actions">
              <button type="button" className="confirmation-cancel" onClick={handleDuplicateCancel}>Cancel</button>
              <button type="button" className="save-payment-button" onClick={handleViewExistingMember}>View Member Record</button>
            </div>
          </section>
        </div>,
        portalRoot()
      )}

      {confirming && createPortal(
        <div
          className="payment-confirmation-backdrop"
          role="presentation"
          onClick={() => { if (!saving) setConfirming(false) }}
        >
          <section
            className="payment-confirmation-modal add-member-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-add-member-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="confirm-add-member-title">Add member</h3>
            <p>Member name: <strong>{fullName}</strong></p>
            <p>Date paid: <strong>{formatPaidDate(datePaid)}</strong></p>
            <p>Amount paid: <strong>₦{parsedAmount.toLocaleString()}</strong></p>
            <p>Coverage: <strong>{formatMonthYear(coverageStart)} to {formatMonthYear(coverageEnd)}</strong></p>
            <div className="confirmation-actions">
              <button type="button" className="confirmation-cancel" disabled={saving} onClick={() => setConfirming(false)}>Cancel</button>
              <button type="button" className="save-payment-button" disabled={saving} onClick={handleConfirmAdd}>{saving ? 'Saving…' : 'Confirm & Add'}</button>
            </div>
          </section>
        </div>,
        portalRoot()
      )}
    </section>
  )
}

export default AddMember
