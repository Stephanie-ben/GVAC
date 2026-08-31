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

export default PaidYearMonths
