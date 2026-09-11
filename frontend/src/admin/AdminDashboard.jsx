import { useEffect, useMemo, useRef, useState } from 'react'
import { Users, CircleCheck, CircleAlert, Banknote } from 'lucide-react'
import { API_BASE_URL } from '../api.js'
import AdminMembers from './AdminMembers.jsx'
import StatusFeedback from './StatusFeedback.jsx'

const METRIC_CARDS = [
  {
    key: 'committed',
    label: 'Financially Committed Members',
    icon: Users,
    iconClass: 'blue',
    valueKey: 'financially_committed_members',
    format: 'count',
  },
  {
    key: 'upToDate',
    label: 'Financially Up-to-date Members',
    icon: CircleCheck,
    iconClass: 'green',
    valueKey: 'financially_up_to_date_members',
    format: 'count',
  },
  {
    key: 'owing',
    label: 'Members Owing',
    icon: CircleAlert,
    iconClass: 'red',
    valueKey: 'members_owing',
    format: 'count',
  },
  {
    key: 'outstanding',
    label: 'Total Outstanding Dues',
    icon: Banknote,
    iconClass: 'green',
    valueKey: 'amount_outstanding_ngn',
    format: 'naira',
  },
]

function formatMetric(value, format) {
  const amount = Number(value)

  if (format === 'naira') {
    return `₦${amount.toLocaleString()}`
  }

  return amount.toLocaleString()
}

function addedNameFromPath(path) {
  const query = path.includes('?') ? path.slice(path.indexOf('?') + 1) : ''
  return new URLSearchParams(query).get('added')
}

function AdminDashboard({ path, onNavigate }) {
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [activeCard, setActiveCard] = useState(0)
  const scrollerRef = useRef(null)
  const addedName = useMemo(() => addedNameFromPath(path), [path])
  const [addedToast, setAddedToast] = useState(addedName)

  useEffect(() => {
    setAddedToast(addedName)
  }, [addedName])

  const dismissAddedToast = () => {
    setAddedToast(null)
    const query = path.includes('?') ? path.slice(path.indexOf('?') + 1) : ''
    const params = new URLSearchParams(query)
    params.delete('added')
    const next = params.toString()
    onNavigate(next ? `/admin?${next}` : '/admin')
  }

  useEffect(() => {
    let cancelled = false

    fetch(`${API_BASE_URL}/api/admin/dashboard`)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to load dashboard')
        }

        return response.json()
      })
      .then((data) => {
        if (!cancelled) {
          setMetrics(data)
          setLoading(false)
        }
      })
      .catch((loadError) => {
        console.error('Admin dashboard lookup failed:', loadError)
        if (!cancelled) {
          setError(true)
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const updateActiveCard = () => {
    const scroller = scrollerRef.current

    if (!scroller) {
      return
    }

    const card = scroller.querySelector('.admin-metric-card')

    if (!card) {
      return
    }

    const cardWidth = card.getBoundingClientRect().width
    const styles = window.getComputedStyle(scroller)
    const gap = Number.parseFloat(styles.columnGap || styles.gap) || 12
    const step = cardWidth + gap
    const maxScrollLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth)
    const lastIndex = METRIC_CARDS.length - 1

    if (step <= 0 || maxScrollLeft <= 0) {
      setActiveCard(0)
      return
    }

    let nearestIndex = 0
    let nearestDistance = Number.POSITIVE_INFINITY

    for (let index = 0; index <= lastIndex; index += 1) {
      const position = Math.min(index * step, maxScrollLeft)
      const distance = Math.abs(scroller.scrollLeft - position)

      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestIndex = index
      }
    }

    setActiveCard(nearestIndex)
  }

  return (
    <section className="admin-page">
      <div className="admin-dashboard-header">
        <h1>Overview</h1>
        <button className="admin-add-member" type="button" onClick={() => onNavigate('/admin/add-member')}>
          Add Member
        </button>
      </div>

      {loading && (
        <div className="admin-metrics admin-metrics-loading" aria-hidden="true">
          {METRIC_CARDS.map((card) => (
            <div className="admin-metric-card skeleton" key={card.key}></div>
          ))}
        </div>
      )}

      {error && (
        <p className="admin-stub-copy">Unable to load dashboard figures.</p>
      )}

      {metrics && (
        <>
          <div
            className="admin-metrics"
            ref={scrollerRef}
            onScroll={updateActiveCard}
          >
            {METRIC_CARDS.map((card) => {
              const Icon = card.icon

              return (
                <article className="admin-metric-card" key={card.key}>
                  <div className={`overview-icon ${card.iconClass}`}>
                    <Icon size={24} strokeWidth={2} />
                  </div>
                  <strong>{formatMetric(metrics[card.valueKey], card.format)}</strong>
                  <span>{card.label}</span>
                </article>
              )
            })}
          </div>

          <div className="admin-metrics-dots" aria-hidden="true">
            {METRIC_CARDS.map((card, index) => (
              <span
                className={`admin-metrics-dot${activeCard === index ? ' active' : ''}`}
                key={card.key}
              ></span>
            ))}
          </div>
        </>
      )}

      <AdminMembers path={path} onNavigate={onNavigate} />

      {addedToast && (
        <StatusFeedback
          type="success"
          message={`${addedToast} has been added successfully.`}
          onClose={dismissAddedToast}
        />
      )}
    </section>
  )
}

export default AdminDashboard
