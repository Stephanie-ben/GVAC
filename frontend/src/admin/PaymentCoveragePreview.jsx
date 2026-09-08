import { useMemo, useRef, useState } from 'react'
import { API_BASE_URL } from '../api.js'
import StatusFeedback from './StatusFeedback.jsx'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function pad2(value) {
  return String(value).padStart(2, '0')
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

function splitPeriod(period) {
  const [year = '', month = ''] = (period || '').split('-')
  return { year, month }
}

function buildPeriod(year, month) {
  return year && month ? `${year}-${pad2(month)}-01` : ''
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

function clampPaidDay(year, month, day) {
  const max = daysInMonth(year, month)
  const value = Number(day)
  if (!value) return day
  return pad2(Math.min(value, max))
}

function formatPaymentDate(isoDate) {
  const [year, month, day] = (isoDate || '').split('-').map(Number)
  if (!year || !month || !day) return ''
  return `${day} ${MONTHS[month - 1]} ${year}`
}

function formatMonthYear(period) {
  const [year, month] = (period || '').split('-').map(Number)
  if (!year || !month) return ''
  return `${MONTHS[month - 1]} ${year}`
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

function coverageMismatchMessage(data, parsedAmount) {
  const selectedTotal = Number(data.coverage?.amount_ngn)
  if (Number.isFinite(selectedTotal) && selectedTotal !== parsedAmount) {
    return `Selected coverage totals ₦${selectedTotal.toLocaleString()}, which does not match the entered amount of ₦${parsedAmount.toLocaleString()}.`
  }

  const proposed = data.proposed_coverage
  if (proposed?.start_period && proposed?.end_period) {
    return `Selected coverage does not match the oldest outstanding months this payment would clear (${proposed.start_period.slice(0, 7)} to ${proposed.end_period.slice(0, 7)}).`
  }

  return 'Selected coverage does not match the oldest outstanding months this payment would clear.'
}

function CoverageDateFields({ label, period, years, onChange }) {
  const { year, month } = splitPeriod(period)
  return (
    <fieldset className="coverage-date-fields">
      <legend>{label}</legend>
      <label>
        <span>Month</span>
        <select value={month} onChange={(event) => onChange(buildPeriod(year, event.target.value))}>
          {MONTHS.map((name, index) => (
            <option value={pad2(index + 1)} key={name}>{name}</option>
          ))}
        </select>
      </label>
      <label>
        <span>Year</span>
        <select value={year} onChange={(event) => onChange(buildPeriod(event.target.value, month))}>
          {years.map((value) => (
            <option value={value} key={value}>{value}</option>
          ))}
        </select>
      </label>
    </fieldset>
  )
}

function PaymentCoveragePreview({ memberId, memberName, memberDues, onSaved }) {
  const dateYears = useMemo(() => paidYears(), [])
  const [amount, setAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(todayIsoDate)
  const [coverage, setCoverage] = useState(null)
  const [preview, setPreview] = useState(null)
  const [previewError, setPreviewError] = useState(null)
  const [saveError, setSaveError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const requestId = useRef(0)
  const dueYears = memberDues.map((due) => new Date(due.period_start).getFullYear())
  const parsedAmount = Number(amount)
  const futureMonths = Number.isInteger(parsedAmount) && parsedAmount > 0
  ? Math.ceil(parsedAmount / 500)
  : 0

  const baseYears = dueYears.length > 0
  ? dueYears
  : [new Date().getFullYear()]

  const minYear = Math.min(...baseYears)
  const maxYear = Math.max(...baseYears)

  const futureEndYear = new Date().getFullYear() +
  Math.ceil(futureMonths / 12)

  const years = Array.from(
  {
    length: Math.max(maxYear, futureEndYear) - minYear + 1,
  },

  (_, index) => minYear + index
)
  const requestPreview = async (nextAmount, nextCoverage = null) => {
    const parsedAmount = Number(nextAmount)
    if (!Number.isInteger(parsedAmount) || parsedAmount <= 0) {
      setPreview(null)
      setPreviewError(nextAmount ? 'Enter a whole payment amount greater than zero.' : null)
      return
    }

    const currentRequest = ++requestId.current
    setLoading(true)
    setPreviewError(null)
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/members/${memberId}/payment-preview`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount_ngn: parsedAmount, ...(nextCoverage ? { coverage: nextCoverage } : {}) }),
      })
      const data = await response.json()
      if (currentRequest !== requestId.current) return
      if (!response.ok) {
        throw new Error(
          data.error === 'The amount must exactly clear whole outstanding monthly dues.'
            ? 'The amount should clear one or more months.'
            : (data.error || 'Unable to calculate coverage.')
        )
      }
      setPreview(data)
      if (!nextCoverage) setCoverage(data.coverage)
      setPreviewError(data.valid ? null : coverageMismatchMessage(data, parsedAmount))
    } catch (error) {
      if (currentRequest === requestId.current) {
        setPreview(null)
        setPreviewError(error.message)
      }
    } finally {
      if (currentRequest === requestId.current) setLoading(false)
    }
  }

  const changeAmount = (event) => {
    const nextAmount = event.target.value
    setAmount(nextAmount)
    setCoverage(null)
    setSaveError(null)
    requestPreview(nextAmount)
  }

  const changeCoverage = (field, period) => {
    const nextCoverage = { ...coverage, [field]: period }
    setCoverage(nextCoverage)
    setSaveError(null)
    requestPreview(amount, nextCoverage)
  }

  const savePayment = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/members/${memberId}/payments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount_ngn: Number(amount), payment_date: paymentDate, coverage }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Payment could not be saved.')
      setConfirming(false)
      setFeedback({ type: 'success', message: `${memberName} has been updated successfully.` })
      setAmount('')
      setCoverage(null)
      setPreview(null)
      onSaved()
    } catch {
      setConfirming(false)
      setSaveError('Member could not be updated. Please try again.')
      setFeedback({ type: 'error', message: 'Member could not be updated. Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  const amountNumber = Number(amount)
  const canSave = Boolean(preview?.valid && coverage && paymentDate && Number.isInteger(amountNumber) && amountNumber > 0 && !previewError && !loading)

  return (
    <div className="payment-record-flow">
      <section className="payment-management-card">
        <div className="section-heading">
          <p className="eyebrow">PAYMENT DETAILS</p>
        </div>
        <PaidDateFields label="Date paid" date={paymentDate} years={dateYears} onChange={setPaymentDate} />
        <label className="payment-amount-field" htmlFor="payment-amount">
          <span>Amount paid</span>
          <span className="payment-amount-control">
            <span className="payment-amount-prefix">₦</span>
            <input id="payment-amount" inputMode="numeric" type="text" autoComplete="off" value={amount} onChange={changeAmount} />
          </span>
        </label>
        {!coverage && loading && <p className="payment-preview-status">Calculating coverage…</p>}
        {!coverage && previewError && <p className="payment-preview-error" role="alert">{previewError}</p>}
      </section>

      {coverage && (
        <section className="payment-management-card">
          <div className="section-heading">
            <p className="eyebrow">COVERAGE PREVIEW</p>
          </div>
          <div className="coverage-preview">
            <div className="coverage-date-grid">
              <CoverageDateFields label="Coverage Start" period={coverage.start_period} years={years} onChange={(period) => changeCoverage('start_period', period)} />
              <CoverageDateFields label="Coverage End" period={coverage.end_period} years={years} onChange={(period) => changeCoverage('end_period', period)} />
            </div>
            {loading && <p className="payment-preview-status">Calculating coverage…</p>}
            {previewError && <p className="payment-preview-error" role="alert">{previewError}</p>}
            {!loading && !previewError && preview?.valid && <p className="payment-preview-status">Coverage matches the entered amount.</p>}
          </div>
        </section>
      )}

      {saveError && <p className="payment-preview-error" role="alert">{saveError}</p>}
      <button className="save-payment-button" type="button" disabled={!canSave} onClick={() => setConfirming(true)}>Save payment</button>

      {confirming && (
        <div
          className="payment-confirmation-backdrop"
          role="presentation"
          onClick={() => setConfirming(false)}
        >
          <section
            className="payment-confirmation-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-payment-title"
            onClick={(event) => event.stopPropagation()}
          >
<h3 id="confirm-payment-title">Confirm payment</h3>

<div className="confirmation-details-box">
  <p>Member name: <strong>{memberName}</strong></p>
  <p>Date paid: <strong>{formatPaymentDate(paymentDate)}</strong></p>
  <p>Amount paid: <strong>₦{amountNumber.toLocaleString()}</strong></p>
  <p>Coverage: <strong>{formatMonthYear(coverage.start_period)} to {formatMonthYear(coverage.end_period)}</strong></p>
</div>

<div className="payment-confirmation-actions">
  <button
    type="button"
    className="cancel-button"
    onClick={() => setConfirming(false)}
  >
    Cancel
  </button>
  <button
    type="button"
    className="save-payment-button"
    disabled={saving}
    onClick={savePayment}
  >
    {saving ? 'Saving…' : 'Confirm payment'}
  </button>
</div>

</section>
</div>
    
  )}

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

export default PaymentCoveragePreview
