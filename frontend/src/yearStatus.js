export function getYearDues(memberDues, year) {
  return memberDues.filter((item) => {
    const date = new Date(item.period_start)
    return date.getFullYear() === year
  })
}

export function getHistoryYears(memberDues, asOf = new Date()) {
  const currentYear = asOf.getFullYear()
  const duesYears = memberDues
    .map((due) => new Date(due.period_start).getFullYear())
    .filter((year) => Number.isFinite(year))

  if (duesYears.length === 0) {
    return [currentYear]
  }

  const earliestYear = Math.min(...duesYears)
  const latestYear = Math.max(currentYear, ...duesYears)

  return Array.from(
    { length: latestYear - earliestYear + 1 },
    (_, index) => latestYear - index
  )
}

export function getYearStatus(year, memberDues, duesStartMonth) {
  if (year === 2020) {
    return "Excluded"
  }

  const yearDues = getYearDues(memberDues, year)

  if (yearDues.length === 0) {
    return "No dues recorded"
  }

  const startDate = duesStartMonth
    ? new Date(duesStartMonth)
    : null

  const hasOutstanding = yearDues.some((due) => {
    if (due.source_status === "writeoff_marker") {
      return false
    }

    if (startDate && new Date(due.period_start) < startDate) {
      return false
    }

    return Number(due.amount_allocated_ngn) < Number(due.amount_due_ngn)
  })

  return hasOutstanding ? "Outstanding dues" : "Fully paid"
}

export function getYearStatusClass(year, memberDues, duesStartMonth) {
  const status = getYearStatus(year, memberDues, duesStartMonth)

  if (status === "No dues recorded") {
    return "no-dues"
  }

  if (status === "Outstanding dues") {
    return "outstanding"
  }

  return ""
}

export function getMonthDisplayStatus(year, monthNumber, dues, duesStartMonth) {
  const due = dues.find((item) => {
    const date = new Date(item.period_start)
    return date.getFullYear() === year && date.getMonth() + 1 === monthNumber
  })

  if (due?.source_status === "writeoff_marker") {
    return "writeoff"
  }

  const startDate = duesStartMonth ? new Date(duesStartMonth) : null
  if (
    startDate &&
    year === startDate.getFullYear() &&
    monthNumber < startDate.getMonth() + 1
  ) {
    return "not-member"
  }

  if (due) {
    const amountDue = Number(due.amount_due_ngn)
    const amountAllocated = Number(due.amount_allocated_ngn)

    if (amountAllocated === amountDue) {
      return "paid"
    }

    if (due.source_status === "outstanding" && amountAllocated < amountDue) {
      return "overdue"
    }
  }

  return "neutral"
}
