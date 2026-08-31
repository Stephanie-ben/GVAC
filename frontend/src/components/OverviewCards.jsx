import { Users, Banknote, CalendarDays } from 'lucide-react'

function OverviewCards() {
  return (
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
  )
}

export default OverviewCards
