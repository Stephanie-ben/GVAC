import { Fragment } from 'react'
import PaidYearMonths from './PaidYearMonths.jsx'
import {
  getHistoryYears,
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
  const years = getHistoryYears(memberDues)

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
