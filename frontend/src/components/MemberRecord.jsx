import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import YearHistoryList from './YearHistoryList.jsx'

function MemberRecord({
  selectedMember,
  outstandingBalance,
  paymentAccounts,
  memberDues,
  duesStartMonth,
  openYear,
  onOpenYearChange,
  onBack,
  backLabel = '← Back to Home',
  eyebrow = 'PERSONAL DUES RECORD',
  headerAction = null,
  memberDetails = null,
  footer = null,
}) {
  const [copiedAccountId, setCopiedAccountId] = useState(null)

  return (
    <div className="app">
      <main>
        <section className="record-page">

  <div className="sticky-back-header">
  <button
    className="back-button"
    onClick={onBack}
  >
    {backLabel}
  </button>
  {headerAction}
</div>

<div className="record-header">
 
 <p className="eyebrow">{eyebrow}</p>
  <h1>{selectedMember.full_name}</h1>
</div>

<section className="account-summary">
  <div className="balance-card">
    <p className="eyebrow">OUTSTANDING BALANCE</p>
    <p className="balance-amount">
      ₦{Number(outstandingBalance).toLocaleString()}
    </p>
  </div>

  {memberDetails}

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

  <YearHistoryList
    memberDues={memberDues}
    duesStartMonth={duesStartMonth}
    openYear={openYear}
    onOpenYearChange={onOpenYearChange}
  />
</section>
{footer}
</section>
</main>
</div>
  )
}

export default MemberRecord
