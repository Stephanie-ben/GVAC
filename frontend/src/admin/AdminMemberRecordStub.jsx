import { useEffect, useState } from 'react'
import { adminFetch } from './adminApi.js'
import MemberRecord from '../components/MemberRecord.jsx'
import RecordSkeleton from '../components/RecordSkeleton.jsx'
import PaymentCoveragePreview from './PaymentCoveragePreview.jsx'

function AdminMemberRecordStub({ memberId, onNavigate }) {
  const [member, setMember] = useState(null)
  const [memberDues, setMemberDues] = useState([])
  const [duesStartMonth, setDuesStartMonth] = useState(null)
  const [outstandingBalance, setOutstandingBalance] = useState(0)
  const [openYear, setOpenYear] = useState(2026)
  const [loading, setLoading] = useState(true)
  const [paymentManagementOpen, setPaymentManagementOpen] = useState(false)
  const [recordVersion, setRecordVersion] = useState(0)

  useEffect(() => {
    let cancelled = false

    Promise.all([
      adminFetch(`/api/members/${memberId}`).then((response) => {
        if (!response.ok) throw new Error('Member not found')
        return response.json()
      }),
      adminFetch(`/api/members/${memberId}/dues`).then((response) => {
        if (!response.ok) throw new Error('Member dues not found')
        return response.json()
      }),
    ])
      .then(([memberData, duesData]) => {
        if (!cancelled) {
          setMember(memberData)
          setMemberDues(duesData.dues)
          setDuesStartMonth(duesData.regular_dues_start_month)
          setOutstandingBalance(duesData.outstanding_balance_ngn)
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
  }, [memberId, recordVersion])

  if (loading) return <RecordSkeleton />

  if (!member) {
    return <section className="admin-page"><p className="admin-stub-copy">Member record could not be loaded.</p></section>
  }

  return (
    <MemberRecord
      selectedMember={member}
      outstandingBalance={outstandingBalance}
      paymentAccounts={[]}
      memberDues={memberDues}
      duesStartMonth={duesStartMonth}
      openYear={openYear}
      onOpenYearChange={setOpenYear}
      onBack={() => onNavigate('/admin')}
      backLabel="← Back to Members"
      eyebrow="ADMIN MEMBER RECORD"
      headerAction={<button className="record-payment-button" type="button" onClick={() => setPaymentManagementOpen((isOpen) => !isOpen)}>{paymentManagementOpen ? 'Hide Payment' : 'Record Payment'}</button>}
      showAccountDetails={false}
      beforeHistory={paymentManagementOpen ? <PaymentCoveragePreview memberId={memberId} memberName={member.full_name} memberDues={memberDues} onSaved={() => setRecordVersion((version) => version + 1)} /> : null}
    />
  )
}

export default AdminMemberRecordStub
