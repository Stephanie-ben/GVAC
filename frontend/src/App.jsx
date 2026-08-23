import { Fragment, useEffect, useState } from 'react'
import { Users, Banknote, CalendarDays, Info, Copy, Check } from 'lucide-react'
import './App.css'

const members = [
  'Stephanie Durugbor',
  'Magdalene Obi',
  'Obi Sopulu',
  'Amaka Ekeh',
  'Chukwuemeka Okafor',
  'Nneka Williams',
]

function PaidYearMonths({ year, dues, duesStartMonth }) {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ]

  const yearDues = dues.filter(
  (item) => new Date(item.period_start).getFullYear() === year
)

  return (
    <div className="month-grid">
      {months.map((month, index) => {
        const monthNumber = index + 1

        const due = dues.find((item) => {
          const date = new Date(item.period_start)

          return (
            date.getFullYear() === year &&
            date.getMonth() + 1 === monthNumber
          )
        })

        let status = "neutral"

        const startDate = duesStartMonth ? new Date(duesStartMonth) : null

if (
  startDate &&
  year === startDate.getFullYear() &&
  monthNumber < startDate.getMonth() + 1
) {
  status = "not-member"
        } else if (due) {
          const amountDue = Number(due.amount_due_ngn)
          const amountAllocated = Number(due.amount_allocated_ngn)

          if (due.source_status === "writeoff_marker") {
            status = "paid"
          } else if (amountAllocated === amountDue) {
            status = "paid"
          } else if (
            due.source_status === "outstanding" &&
            amountAllocated < amountDue
          ) {
            status = "overdue"
          }
        }

        return (
          <div className={`month-item ${status}`} key={month}>
            <span>{month}</span>
            <span className="month-status">
              {status === "paid" ? "✓" : status === "overdue" ? "!" : ""}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function App() {
  const [search, setSearch] = useState('')
  const [selectedMember, setSelectedMember] = useState(null)
  const [loadingMember, setLoadingMember] = useState(true)

useEffect(() => {
  const match = window.location.pathname.match(/^\/members\/(.+)$/)

  if (!match) {
   setLoadingMember(false)  
  return
  }

  const memberId = match[1]

  fetch(`http://192.168.101.18:3001/api/members/${memberId}`)
    .then((response) => {
      if (!response.ok) {
        throw new Error("Member not found")
      }

      return response.json()
    })
    .then((member) => {
      setSelectedMember(member)
      setLoadingMember(false)
    })
    .catch((error) => {
      console.error("Member lookup failed:", error)
      setLoadingMember(false)
}) 

.finally(() => {
  setLoadingMember(false)   
 })
}, [])

  useEffect(() => {
  if (selectedMember) {
    window.scrollTo(0, 0)
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }
}, [selectedMember])

  const [openYear, setOpenYear] = useState(2026)
  const [results, setResults] = useState([])
  const [memberDues, setMemberDues] = useState([])
  const [duesStartMonth, setDuesStartMonth] = useState(null)
  const [outstandingBalance, setOutstandingBalance] = useState(0)
  const [paymentAccounts, setPaymentAccounts] = useState([])
  const [copiedAccountId, setCopiedAccountId] = useState(null)  
  const getYearDues = (year) => {
  return memberDues.filter((item) => {
    const date = new Date(item.period_start)
    return date.getFullYear() === year
  })
}

const getYearStatus = (year) => {
  if (year === 2020) {
    return "Excluded"
  }

  const yearDues = getYearDues(year)

  if (yearDues.length === 0) {
    return "No dues recorded"
  }

  const startDate = duesStartMonth
    ? new Date(duesStartMonth)
    : null

  const applicableDues = yearDues.filter((due) => {
    if (!startDate) {
      return true
    }

    const dueDate = new Date(due.period_start)

    return dueDate >= startDate
  })

  if (applicableDues.length === 0) {
    return "No dues recorded"
  }

  const hasOutstanding = applicableDues.some((due) => {
    const amountDue = Number(due.amount_due_ngn)
    const amountAllocated = Number(due.amount_allocated_ngn)

    if (due.source_status === "writeoff_marker") {
      return false
    }

    return amountAllocated < amountDue
  })

  return hasOutstanding ? "Outstanding dues" : "Fully paid"
}

const getYearStatusClass = (year) => {
  const status = getYearStatus(year)

  if (status === "No dues recorded") {
    return "no-dues"
  }

  if (status === "Outstanding dues") {
    return "outstanding"
  }

  return ""
}

useEffect(() => {
    if (!search.trim()) {
    setResults([])
    return
  }

  let cancelled = false

  const timer = setTimeout(() => {
    fetch(`http://192.168.101.18:3001/api/members?search=${encodeURIComponent(search)}`)
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) {
          setResults(data)
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('Member search failed:', error)
          setResults([])
        }
      })
  }, 250)

  return () => {
    cancelled = true
    clearTimeout(timer)
  }
}, [search])

useEffect(() => {
  fetch('http://192.168.101.18:3001/api/payment-accounts')
    .then((response) => response.json())
    .then((data) => setPaymentAccounts(data))
    .catch((error) => {
      console.error('Payment accounts lookup failed:', error)
      setPaymentAccounts([])
    })
}, [])

useEffect(() => {
  if (!selectedMember) {
    setMemberDues([])
    return
  }

  fetch(`http://192.168.101.18:3001/api/members/${selectedMember.id}/dues`)
    .then((response) => response.json())
    .then((data) => {
  setMemberDues(data.dues)
  setDuesStartMonth(data.regular_dues_start_month)
  setOutstandingBalance(data.outstanding_balance_ngn)
})
    .catch((error) => {
      console.error('Member dues lookup failed:', error)
      setMemberDues([])
    })
}, [selectedMember])

if (loadingMember) {
  return (
    <div className="record-page record-loading">
      <div className="skeleton skeleton-eyebrow"></div>
      <div className="skeleton skeleton-title"></div>

      <div className="skeleton-history">
        <div className="skeleton skeleton-section-title"></div>

        <div className="skeleton-year-groups">
  <div className="skeleton-year-group">
    <div className="skeleton-year-card"></div>
  </div>

  <div className="skeleton-year-group">
    <div className="skeleton-year-card"></div>
    <div className="skeleton-year-card"></div>
  </div>

  <div className="skeleton-year-group">
    <div className="skeleton-year-card"></div>
    <div className="skeleton-year-card"></div>
    <div className="skeleton-year-card"></div>
  </div>
</div>
      </div>
    </div>
  )
}

if (selectedMember) {
const currentYear = new Date().getFullYear()
  const duesYears = memberDues.map((due) =>
    new Date(due.period_start).getFullYear()
  )
  const latestDuesYear = duesYears.length > 0 ? Math.max(...duesYears) : currentYear
  const latestYear = Math.max(currentYear, latestDuesYear, 2018)

  const years = Array.from(
    { length: latestYear - 2018 + 1 },
    (_, index) => latestYear - index
  )
  return (
    <div className="app">
      <main>
        <section className="record-page">

  <div className="sticky-back-header">
  <button
    className="back-button"
    onClick={() => {
  setSelectedMember(null)
  window.history.pushState({}, "", "/")
}}
  >
    ← Back to Home
  </button>
</div>

<div className="record-header">
 
 <p className="eyebrow">PERSONAL DUES RECORD</p>
  <h1>{selectedMember.full_name}</h1>
</div>

<section className="account-summary">
  <div className="balance-card">
    <p className="eyebrow">OUTSTANDING BALANCE</p>
    <p className="balance-amount">
      ₦{Number(outstandingBalance).toLocaleString()}
    </p>
  </div>

  <div className="account-details-card">
    <div className="section-heading">
      <p className="eyebrow">ACCOUNT DETAILS</p>
    </div>

    {paymentAccounts.map((account) => (
      <div className="account-details" key={account.id}>
        <div>

<div className="account-number-row">
  <span className="account-number">  
    {account.account_number}
  </span>
          
  <button
  className="copy-account-button"
  aria-label="Copy account number"
  title={copiedAccountId === account.id ? "Copied!" : "Copy account number"}
  onClick={async () => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(account.account_number)
    } else {
      const textArea = document.createElement("textarea")
      textArea.value = account.account_number
      textArea.style.position = "fixed"
      textArea.style.opacity = "0"
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      document.execCommand("copy")
      document.body.removeChild(textArea)
    }

    setCopiedAccountId(account.id)

    setTimeout(() => {
      setCopiedAccountId(null)
    }, 1500)
  } catch (error) {
    console.error("Failed to copy account number:", error)
  }
}}
>
  {copiedAccountId === account.id ? (
    <>
      <Check size={18} strokeWidth={1.8} />
      <span>Copied!</span>
    </>
  ) : (
    <Copy size={18} strokeWidth={1.8} />
  )}
</button>
</div>
          <p className="account-bank">{account.bank_name}</p>
          <p className="account-name">{account.account_name}</p>
        </div>

      </div>
    ))}
  </div>
</section>

<section className="payment-history">

  <div className="section-heading">
    <p className="eyebrow">PAYMENT HISTORY</p>
  </div>

  <div className="year-list">

{years.map((year) => {
  if (year === 2020) {
    return (
      <div className="year-row excluded" key={year}>
        <span className="year">{year}</span>
        <span className="year-status">Excluded</span>
      </div>
    )
  }

  const yearDues = getYearDues(year)

  if (yearDues.length > 0) {
    return (
       <Fragment key={year}>
        <button
          className="year-row"
          onClick={() => setOpenYear(openYear === year ? null : year)}
        >
          <span className="year">{year}</span>

          <span className={`year-status ${getYearStatusClass(year)}`}>
            {getYearStatus(year)}
          </span>

          <span className={`year-arrow ${openYear === year ? "open" : ""}`}>
            <span className="chevron"></span>
          </span>
        </button>

        {openYear === year && (
          <PaidYearMonths
  year={year}
  dues={memberDues}
  duesStartMonth={duesStartMonth}
/>
        )}
      </Fragment>
    )
  }

  return (
    <div className="year-row" key={year}>
      <span className="year">{year}</span>

      <span className={`year-status ${getYearStatusClass(year)}`}>
        {getYearStatus(year)}
      </span>

      <span className="year-arrow-placeholder"></span>
    </div>
  )
})}  

  </div>
</section>
</section>
</main>
</div>
)
}

return (
  <div className="app">
  
      <main>
        <section className="hero">

          <h1 className="zone-title">
           <span>GVAC</span>
           <span>LAGOS ZONE</span>
         </h1>

          <p className="hero-description">
            View your payment status and keep track of your contribution
            history.
          </p>

          <div className="search-card">
            <label htmlFor="member-search">Find your record</label>

            <div className="search-input">
              <span>⌕</span>

              <input
                id="member-search"
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search your name"
                autoComplete="off"
              />
            </div>

            <p className="search-hint">
              Search using your first or last name.
            </p>

            {results.length > 0 && (
              <div className="search-results">
                {results.map((member) => (
                  <button
                    className="search-result"
                    key={member.id}
                    onClick={() => {
  setSelectedMember(member)
  window.history.pushState(
    {},
    "",
    `/members/${member.id}`
  )
}}
                  >
                    <span className="result-icon">○</span>
                    <span>{member.full_name}</span>
                  </button>
                ))}
              </div>
            )}

            {search.trim() && results.length === 0 && (
              <div className="no-results">
                No member found. Try another name.
              </div>
            )}
          </div>
        </section>

        <section className="overview">
  <div className="section-heading">
    <p className="eyebrow">OVERVIEW</p>
  </div>

  <div className="overview-grid">
    <div className="overview-card financially-committed-card">
      <div className="overview-icon blue">
        <Users size={24} strokeWidth={2} />
      </div>
      <strong>104</strong>
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

  <div className="dues-notice">
    <div className="notice-icon">
      <Info size={20} strokeWidth={2} />
    </div>

    <div className="exclusion-note">
      <span>2020 dues excluded.</span>
      <span>No dues were collected during the COVID-19 period.</span>
    </div>
  </div>
</section>
      </main>
    </div>
  )
}

export default App
