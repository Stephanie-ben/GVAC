import { Fragment } from 'react'
import PaidYearMonths from './PaidYearMonths.jsx'
import {
  getYearDues,
  getYearStatus,
  getYearStatusClass,
} from '../yearStatus.js'

function YearHistoryList({
  memberDues,
  duesStartMonth,
  openYear,
  onOpenYearChange,
}) {
  const currentYear = new Date().getFullYear()
  const duesYears = memberDues.map((due) =>
    new Date(due.period_start).getFullYear()
  )
  const latestDuesYear = duesYears.length > 0 ? Math.max(...duesYears) : currentYear
  const latestYear = Math.max(currentYear, latestDuesYear, 2018)

  const years = Array.from(
    { length: latestYear - 2018 + 1 },
    (_, index) => latestYear - index
  )

  return (
  <div className="year-list">

{years.map((year) => {
  if (year === 2020) {
    return (
      <div className="year-row excluded" key={year}>
        <span className="year">{year}</span>
        <span className="year-status">Excluded</span>
      </div>
    )
  }

  const yearDues = getYearDues(memberDues, year)

  if (yearDues.length > 0) {
    return (
       <Fragment key={year}>
        <button
          className="year-row"
          onClick={() => onOpenYearChange(openYear === year ? null : year)}
        >
          <span className="year">{year}</span>

          <span className={`year-status ${getYearStatusClass(year, memberDues, duesStartMonth)}`}>
            {getYearStatus(year, memberDues, duesStartMonth)}
          </span>

          <span className={`year-arrow ${openYear === year ? "open" : ""}`}>
            <span className="chevron"></span>
          </span>
        </button>

        {openYear === year && (
          <PaidYearMonths
  year={year}
  dues={memberDues}
  duesStartMonth={duesStartMonth}
/>
        )}
      </Fragment>
    )
  }

  return (
    <div className="year-row" key={year}>
      <span className="year">{year}</span>

      <span className={`year-status ${getYearStatusClass(year, memberDues, duesStartMonth)}`}>
        {getYearStatus(year, memberDues, duesStartMonth)}
      </span>

      <span className="year-arrow-placeholder"></span>
    </div>
  )
})}  

  </div>
  )
}

export default YearHistoryList
