import { useEffect, useState } from 'react'
import { API_BASE_URL } from '../api.js'
import MemberRecord from '../components/MemberRecord.jsx'
import DuesNotice from '../components/DuesNotice.jsx'
import RecordSkeleton from '../components/RecordSkeleton.jsx'
import PaymentCoveragePreview from './PaymentCoveragePreview.jsx'

function AdminMemberRecordStub({ memberId, onNavigate }) {
  const [member, setMember] = useState(null)
  const [memberDues, setMemberDues] = useState([])
  const [duesStartMonth, setDuesStartMonth] = useState(null)
  const [outstandingBalance, setOutstandingBalance] = useState(0)
  const [paymentAccounts, setPaymentAccounts] = useState([])
  const [openYear, setOpenYear] = useState(2026)
  const [loading, setLoading] = useState(true)
  const [paymentManagementOpen, setPaymentManagementOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    Promise.all([
      fetch(`${API_BASE_URL}/api/members/${memberId}`).then((response) => {
        if (!response.ok) throw new Error('Member not found')
        return response.json()
      }),
      fetch(`${API_BASE_URL}/api/members/${memberId}/dues`).then((response) => {
        if (!response.ok) throw new Error('Member dues not found')
        return response.json()
      }),
      fetch(`${API_BASE_URL}/api/payment-accounts`).then((response) => response.json()),
    ])
      .then(([memberData, duesData, accounts]) => {
        if (!cancelled) {
          setMember(memberData)
          setMemberDues(duesData.dues)
          setDuesStartMonth(duesData.regular_dues_start_month)
          setOutstandingBalance(duesData.outstanding_balance_ngn)
          setPaymentAccounts(accounts)
        }
      })
      .catch((error) => {
        console.error('Admin member lookup failed:', error)
        if (!cancelled) {
          setMember(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [memberId])

  if (loading) return <RecordSkeleton />

  if (!member) {
    return <section className="admin-page"><p className="admin-stub-copy">Member record could not be loaded.</p></section>
  }

  return (
    <MemberRecord
      selectedMember={member}
      outstandingBalance={outstandingBalance}
      paymentAccounts={paymentAccounts}
      memberDues={memberDues}
      duesStartMonth={duesStartMonth}
      openYear={openYear}
      onOpenYearChange={setOpenYear}
      onBack={() => onNavigate('/admin/members')}
      backLabel="← Back to Members"
      eyebrow="ADMIN MEMBER RECORD"
      headerAction={<button className="record-payment-button" type="button" onClick={() => setPaymentManagementOpen((isOpen) => !isOpen)}>{paymentManagementOpen ? 'Hide payment' : 'Record payment'}</button>}
      memberDetails={<div className="account-details-card"><div className="section-heading"><p className="eyebrow">MEMBER DETAILS</p></div><div className="member-meta"><div className="meta-item"><span>Dues start</span><strong>{duesStartMonth ? new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(new Date(duesStartMonth)) : 'Not recorded'}</strong></div><div className="meta-item"><span>Membership status</span><strong>{member.membership_status}</strong></div></div></div>}
      beforeHistory={paymentManagementOpen ? <PaymentCoveragePreview memberId={memberId} memberDues={memberDues} /> : null}
      footer={<DuesNotice />}
    />
  )
}

export default AdminMemberRecordStub
