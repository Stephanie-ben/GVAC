import { Info } from 'lucide-react'

function DuesNotice() {
  return (
    <div className="dues-notice">
    <div className="notice-icon">
      <Info size={20} strokeWidth={2} />
    </div>

    <div className="exclusion-note">
      <span>2020 dues excluded.</span>
      <span>No dues were collected during the COVID-19 period.</span>
    </div>
  </div>
  )
}

export default DuesNotice
