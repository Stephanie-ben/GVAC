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

function isBeforeDuesStart(year, monthNumber, duesStartMonth) {
  if (!duesStartMonth) return false
  const startDate = new Date(duesStartMonth)
  const startYear = startDate.getFullYear()
  const startMonth = startDate.getMonth() + 1
  return year < startYear || (year === startYear && monthNumber < startMonth)
}

function isFutureMonth(year, monthNumber, asOf) {
  const asOfYear = asOf.getFullYear()
  const asOfMonth = asOf.getMonth() + 1
  return year > asOfYear || (year === asOfYear && monthNumber > asOfMonth)
}

function isApplicableMonth(year, monthNumber, duesStartMonth, asOf) {
  if (year === 2020) return false
  if (isFutureMonth(year, monthNumber, asOf)) return false
  if (isBeforeDuesStart(year, monthNumber, duesStartMonth)) return false
  return true
}

function findMonthDue(dues, year, monthNumber) {
  return dues.find((item) => {
    const date = new Date(item.period_start)
    return date.getFullYear() === year && date.getMonth() + 1 === monthNumber
  })
}

function isMonthSettled(due) {
  if (!due) return false
  if (due.source_status === "writeoff_marker") return true
  return Number(due.amount_allocated_ngn) >= Number(due.amount_due_ngn)
}

export function getYearStatus(year, memberDues, duesStartMonth, asOf = new Date()) {
  if (year === 2020) {
    return "Excluded"
  }

  const yearDues = getYearDues(memberDues, year)
  let hasApplicable = false
  let hasOutstanding = false

  for (let monthNumber = 1; monthNumber <= 12; monthNumber += 1) {
    if (!isApplicableMonth(year, monthNumber, duesStartMonth, asOf)) continue
    hasApplicable = true
    const due = findMonthDue(yearDues, year, monthNumber)
    if (!isMonthSettled(due)) {
      hasOutstanding = true
    }
  }

  if (!hasApplicable) {
    if (yearDues.length === 0) {
      return "No dues recorded"
    }

    return "Paid"
  }

  return hasOutstanding ? "Outstanding" : "Paid"
}

export function getYearStatusClass(year, memberDues, duesStartMonth) {
  const status = getYearStatus(year, memberDues, duesStartMonth)

  if (status === "No dues recorded") {
    return "no-dues"
  }

  if (status === "Outstanding") {
    return "outstanding"
  }

  return ""
}

export function getMonthDisplayStatus(
  year,
  monthNumber,
  dues,
  duesStartMonth,
  asOf = new Date()
) {
  const due = findMonthDue(dues, year, monthNumber)

  if (due?.source_status === "writeoff_marker") {
    return "writeoff"
  }

  if (duesStartMonth) {
    const startDate = new Date(duesStartMonth)
    if (
      year === startDate.getFullYear() &&
      monthNumber < startDate.getMonth() + 1
    ) {
      return "not-member"
    }
  }

  if (due) {
    const amountDue = Number(due.amount_due_ngn)
    const amountAllocated = Number(due.amount_allocated_ngn)

    if (amountAllocated === amountDue) {
      return "paid"
    }
  }

  if (isFutureMonth(year, monthNumber, asOf)) {
    return "upcoming"
  }

  if (isApplicableMonth(year, monthNumber, duesStartMonth, asOf) && !isMonthSettled(due)) {
    return "overdue"
  }

  if (due) {
    const amountDue = Number(due.amount_due_ngn)
    const amountAllocated = Number(due.amount_allocated_ngn)

    if (due.source_status === "outstanding" && amountAllocated < amountDue) {
      return "overdue"
    }
  }

  return "neutral"
}
