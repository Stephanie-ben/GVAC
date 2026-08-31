export function getYearDues(memberDues, year) {
  return memberDues.filter((item) => {
    const date = new Date(item.period_start)
    return date.getFullYear() === year
  })
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
