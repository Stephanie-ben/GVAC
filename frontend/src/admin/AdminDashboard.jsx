import { useEffect, useRef, useState } from 'react'
import { Users, CircleCheck, CircleAlert, Banknote } from 'lucide-react'
import { API_BASE_URL } from '../api.js'

const METRIC_CARDS = [
  {
    key: 'committed',
    label: 'Financially Committed Members',
    icon: Users,
    iconClass: 'blue',
    valueKey: 'financially_committed_members',
    format: 'count',
    viewDetails: true,
    membersPath: '/admin/members',
  },
  {
    key: 'upToDate',
    label: 'Financially Up-to-date Members',
    icon: CircleCheck,
    iconClass: 'green',
    valueKey: 'financially_up_to_date_members',
    format: 'count',
    viewDetails: true,
    membersPath: '/admin/members?status=up_to_date',
  },
  {
    key: 'owing',
    label: 'Members Owing',
    icon: CircleAlert,
    iconClass: 'red',
    valueKey: 'members_owing',
    format: 'count',
    viewDetails: true,
    membersPath: '/admin/members?status=owing',
  },
  {
    key: 'outstanding',
    label: 'Amount Outstanding',
    icon: Banknote,
    iconClass: 'green',
    valueKey: 'amount_outstanding_ngn',
    format: 'naira',
    viewDetails: false,
  },
]

function formatMetric(value, format) {
  const amount = Number(value)

  if (format === 'naira') {
    return `₦${amount.toLocaleString()}`
  }

  return amount.toLocaleString()
}

function AdminDashboard({ onNavigate }) {
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [activeCard, setActiveCard] = useState(0)
  const scrollerRef = useRef(null)

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
    const index = Math.round(scroller.scrollLeft / (cardWidth + gap))
    setActiveCard(Math.min(Math.max(index, 0), METRIC_CARDS.length - 1))
  }

  return (
    <section className="admin-page">
      <div className="admin-dashboard-header">
        <h1>Dashboard</h1>
        <button className="admin-add-member" type="button">
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
                  {card.viewDetails && (
                    <button
                      className="admin-view-details"
                      type="button"
                      onClick={() => onNavigate(card.membersPath)}
                    >
                      View Details
                    </button>
                  )}
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
    </section>
  )
}

export default AdminDashboard
