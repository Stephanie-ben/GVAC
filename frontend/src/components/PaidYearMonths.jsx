import { getMonthDisplayStatus } from '../yearStatus.js'

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

  return (
    <div className="month-grid">
      {months.map((month, index) => {
        const monthNumber = index + 1
        const status = getMonthDisplayStatus(year, monthNumber, dues, duesStartMonth)

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

export default PaidYearMonths
