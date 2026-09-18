import { useEffect, useRef, useState } from 'react'
import './App.css'
import { API_BASE_URL } from './api.js'
import MemberSearch from './components/MemberSearch.jsx'
import OverviewCards from './components/OverviewCards.jsx'
import DuesNotice from './components/DuesNotice.jsx'
import MemberRecord from './components/MemberRecord.jsx'
import RecordSkeleton from './components/RecordSkeleton.jsx'
import { trackMemberSearch, trackRecordView } from './analytics.js'

function App() {
  const [search, setSearch] = useState('')
  const [selectedMember, setSelectedMember] = useState(null)
  const [loadingMember, setLoadingMember] = useState(true)
  const pendingRecordView = useRef(false)

useEffect(() => {
  const match = window.location.pathname.match(/^\/members\/(.+)$/)

  if (!match) {
   setLoadingMember(false)  
   return
  }

  const memberId = match[1]

  fetch(`${API_BASE_URL}/api/members/${memberId}`)
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
  const [searchPending, setSearchPending] = useState(false)
  const [memberDues, setMemberDues] = useState([])
  const [duesReady, setDuesReady] = useState(false)
  const [duesStartMonth, setDuesStartMonth] = useState(null)
  const [outstandingBalance, setOutstandingBalance] = useState(0)
  const [paymentAccounts, setPaymentAccounts] = useState([])

useEffect(() => {
    if (!search.trim()) {
    setResults([])
    setSearchPending(false)
    return
  }

  let cancelled = false
  setSearchPending(true)

  const timer = setTimeout(() => {
    fetch(`${API_BASE_URL}/api/members?search=${encodeURIComponent(search)}`)
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) {
          setResults(data)
          setSearchPending(false)
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('Member search failed:', error)
          setResults([])
          setSearchPending(false)
        }
      })
  }, 250)

  return () => {
    cancelled = true
    clearTimeout(timer)
  }
}, [search])

useEffect(() => {
  fetch(`${API_BASE_URL}/api/payment-accounts`)
    .then((response) => response.json())
    .then((data) => setPaymentAccounts(data))
    .catch((error) => {
      console.error('Payment accounts lookup failed:', error)
      setPaymentAccounts([])
    })
}, [])

useEffect(() => {
  if (!selectedMember || !pendingRecordView.current) return
  pendingRecordView.current = false
  trackRecordView()
}, [selectedMember])

useEffect(() => {
  if (!selectedMember) {
    setMemberDues([])
    setDuesReady(false)
    return
  }

  setDuesReady(false)
  fetch(`${API_BASE_URL}/api/members/${selectedMember.id}/dues`)
    .then((response) => response.json())
    .then((data) => {
  setMemberDues(data.dues)
  setDuesStartMonth(data.regular_dues_start_month)
  setOutstandingBalance(data.outstanding_balance_ngn)
  setDuesReady(true)
})
    .catch((error) => {
      console.error('Member dues lookup failed:', error)
      setMemberDues([])
      setDuesReady(true)
    })
}, [selectedMember])

if (loadingMember || (selectedMember && !duesReady)) {
  return <RecordSkeleton />
}

if (selectedMember) {
  return (
    <MemberRecord
      selectedMember={selectedMember}
      outstandingBalance={outstandingBalance}
      paymentAccounts={paymentAccounts}
      memberDues={memberDues}
      duesStartMonth={duesStartMonth}
      openYear={openYear}
      onOpenYearChange={setOpenYear}
      onBack={() => {
        setSelectedMember(null)
        window.history.pushState({}, "", "/")
      }}
    />
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
            View your payment status and keep track of your contribution history
          </p>

          <MemberSearch
            search={search}
            onSearchChange={setSearch}
            results={results}
            isSearching={searchPending}
            onSelectMember={(member) => {
              trackMemberSearch()
              pendingRecordView.current = true
              setSelectedMember(member)
              window.history.pushState(
                {},
                "",
                `/members/${member.id}`
              )
            }}
          />
        </section>

        <section className="overview">
  <div className="section-heading">
    <p className="eyebrow">OVERVIEW</p>
  </div>

  <OverviewCards />

  <DuesNotice />
</section>
      </main>
    </div>
  )
}

export default App
