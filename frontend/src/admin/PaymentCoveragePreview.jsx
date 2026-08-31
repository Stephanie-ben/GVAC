import { useRef, useState } from 'react'
import { API_BASE_URL } from '../api.js'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function splitPeriod(period) {
  const [year = '', month = ''] = (period || '').split('-')
  return { year, month }
}

function buildPeriod(year, month) {
  if (!year || !month) return ''
  return `${year}-${String(month).padStart(2, '0')}-01`
}

function CoverageDateFields({ label, period, years, onChange }) {
  const { year, month } = splitPeriod(period)
  return (
    <fieldset className="coverage-date-fields">
      <legend>{label}</legend>
      <label>
        <span>Month</span>
        <select value={month} onChange={(event) => onChange(buildPeriod(year, event.target.value))}>
          {MONTHS.map((name, index) => <option value={String(index + 1).padStart(2, '0')} key={name}>{name}</option>)}
        </select>
      </label>
      <label>
        <span>Year</span>
        <select value={year} onChange={(event) => onChange(buildPeriod(event.target.value, month))}>
          {years.map((value) => <option value={value} key={value}>{value}</option>)}
        </select>
      </label>
    </fieldset>
  )
}

function PaymentCoveragePreview({ memberId, memberDues }) {
  const [amount, setAmount] = useState('')
  const [coverage, setCoverage] = useState(null)
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const requestId = useRef(0)
  const dueYears = memberDues.map((due) => new Date(due.period_start).getFullYear())
  const years = dueYears.length === 0
    ? []
    : Array.from({ length: Math.max(...dueYears) - Math.min(...dueYears) + 1 }, (_, index) => Math.min(...dueYears) + index)

  const requestPreview = async (nextAmount, nextCoverage = null) => {
    const parsedAmount = Number(nextAmount)
    if (!Number.isInteger(parsedAmount) || parsedAmount <= 0) {
      setPreview(null)
      setError(nextAmount ? 'Enter a whole payment amount greater than zero.' : null)
      return
    }

    const currentRequest = ++requestId.current
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/members/${memberId}/payment-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount_ngn: parsedAmount, ...(nextCoverage ? { coverage: nextCoverage } : {}) }),
      })
      const data = await response.json()
      if (currentRequest !== requestId.current) return
      if (!response.ok) throw new Error(data.error || 'Unable to calculate coverage.')
      setPreview(data)
      if (!nextCoverage) setCoverage(data.coverage)
      setError(data.valid ? null : `Selected coverage totals ₦${Number(data.coverage.amount_ngn).toLocaleString()}, which does not match the entered amount of ₦${parsedAmount.toLocaleString()}.`)
    } catch (requestError) {
      if (currentRequest === requestId.current) {
        setPreview(null)
        setError(requestError.message)
      }
    } finally {
      if (currentRequest === requestId.current) setLoading(false)
    }
  }

  const changeAmount = (event) => {
    const nextAmount = event.target.value
    setAmount(nextAmount)
    setCoverage(null)
    requestPreview(nextAmount)
  }

  const changeCoverage = (field, period) => {
    const nextCoverage = { ...coverage, [field]: period }
    setCoverage(nextCoverage)
    requestPreview(amount, nextCoverage)
  }

  return (
    <section className="payment-management-card">
      <div className="section-heading"><p className="eyebrow">PAYMENT MANAGEMENT</p></div>
      <h2>Record payment coverage</h2>
      <label className="payment-amount-field" htmlFor="payment-amount">
        <span>Payment amount (NGN)</span>
        <input id="payment-amount" inputMode="numeric" min="1" step="1" type="number" value={amount} onChange={changeAmount} placeholder="e.g. 1,500" />
      </label>

      {coverage && <div className="coverage-preview">
        <p className="coverage-preview-title">Coverage preview</p>
        <div className="coverage-date-grid">
          <CoverageDateFields label="Coverage starts" period={coverage.start_period} years={years} onChange={(period) => changeCoverage('start_period', period)} />
          <CoverageDateFields label="Coverage ends" period={coverage.end_period} years={years} onChange={(period) => changeCoverage('end_period', period)} />
        </div>
        <p className="coverage-total">Selected coverage: ₦{Number(preview?.coverage.amount_ngn ?? 0).toLocaleString()}</p>
      </div>}

      {loading && <p className="payment-preview-status">Calculating coverage…</p>}
      {error && <p className="payment-preview-error" role="alert">{error}</p>}
      {!error && preview?.valid && <p className="payment-preview-status">Coverage matches the entered amount. Saving is not available yet.</p>}
    </section>
  )
}

export default PaymentCoveragePreview
