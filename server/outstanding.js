function monthKey(periodStart) {
  const periodDate = new Date(periodStart);
  return `${periodDate.getFullYear()}-${String(
    periodDate.getMonth() + 1
  ).padStart(2, "0")}`;
}

function calculateOutstandingBalance(duesStartMonth, duesRows, asOf = new Date()) {
  const currentDate = asOf;
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  const startDate = duesStartMonth ? new Date(duesStartMonth) : null;

  const duesByMonth = new Map(
    duesRows.map((due) => [monthKey(due.period_start), due])
  );

  let outstandingBalance = 0;

  if (startDate) {
    const startYear = startDate.getFullYear();
    const startMonth = startDate.getMonth() + 1;

    let year = startYear;
    let month = startMonth;

    while (
      year < currentYear ||
      (year === currentYear && month <= currentMonth)
    ) {
      // 2020 is excluded completely
      if (year !== 2020) {
        const key = `${year}-${String(month).padStart(2, "0")}`;
        const due = duesByMonth.get(key);

        if (due) {
          // Historical write-off records are already settled
          if (due.source_status !== "writeoff_marker") {
            const unpaidAmount =
              Number(due.amount_due_ngn) - Number(due.amount_allocated_ngn);

            outstandingBalance += Math.max(unpaidAmount, 0);
          }
        } else {
          // No record exists, but the member was already liable.
          // Current standard dues are ₦500/month.
          outstandingBalance += 500;
        }
      }

      month += 1;

      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
  }

  return outstandingBalance;
}

const DUES_ROWS_SQL = `
      SELECT
  md.id AS member_dues_id,
  md.member_id,
  dp.period_start,
  dp.period_status,
  md.amount_due_ngn,
  md.source_status,
  COALESCE(SUM(da.amount_allocated_ngn), 0) AS amount_allocated_ngn
FROM member_dues md
JOIN dues_periods dp
  ON dp.id = md.dues_period_id
LEFT JOIN dues_allocations da
  ON da.member_dues_id = md.id
WHERE (
  dp.period_start < '2020-01-01'
  OR dp.period_start >= '2021-01-01'
)
`;

async function loadMemberDuesRows(pool, memberId) {
  const result = await pool.query(
    `${DUES_ROWS_SQL}
 AND md.member_id = $1
GROUP BY
  md.member_id,
  md.id,
  dp.period_start,
  dp.period_status,
  md.amount_due_ngn,
  md.source_status
ORDER BY dp.period_start
      `,
    [memberId]
  );

  return result.rows;
}

async function loadAllDuesRows(pool) {
  const result = await pool.query(
    `${DUES_ROWS_SQL}
GROUP BY
  md.member_id,
  md.id,
  dp.period_start,
  dp.period_status,
  md.amount_due_ngn,
  md.source_status
ORDER BY dp.period_start
      `
  );

  return result.rows;
}

function toMemberDuesPayload(rows) {
  return rows.map((row) => ({
    period_start: row.period_start,
    period_status: row.period_status,
    amount_due_ngn: row.amount_due_ngn,
    source_status: row.source_status,
    amount_allocated_ngn: row.amount_allocated_ngn,
  }));
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function calendarPeriodStart(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
  }

  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Allocation period is invalid");
  }

  return `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`;
}

function isPayablePeriod(row, duesStartMonth) {
  const period = calendarPeriodStart(row.period_start);
  if (period.startsWith("2020-")) return false;
  if (duesStartMonth && period < calendarPeriodStart(duesStartMonth)) return false;
  if (row.source_status === "writeoff_marker") return false;

  return Number(row.amount_due_ngn) - Number(row.amount_allocated_ngn) > 0;
}

function toPaymentObligations(
  duesRows,
  duesStartMonth = null,
  paymentAmountNgN = 0
) {
  const obligations = duesRows
    .filter((row) => isPayablePeriod(row, duesStartMonth))
    .map((row) => ({
      period_start: calendarPeriodStart(row.period_start),
      period_status: row.period_status,
      amount_due_ngn: Number(row.amount_due_ngn),
      amount_allocated_ngn: Number(row.amount_allocated_ngn),
      unresolved: false,
    }));

  if (!Number.isInteger(paymentAmountNgN) || paymentAmountNgN <= 0) {
    return obligations;
  }

  let remaining = paymentAmountNgN;

  for (const obligation of obligations) {
    remaining -=
      obligation.amount_due_ngn - obligation.amount_allocated_ngn;

    if (remaining <= 0) {
      return obligations;
    }
  }

  const existingPeriods = new Set(
    obligations.map((obligation) =>
      calendarPeriodStart(obligation.period_start)
    )
  );

  let lastPeriod = obligations.length
    ? calendarPeriodStart(obligations[obligations.length - 1].period_start)
    : duesStartMonth
      ? calendarPeriodStart(duesStartMonth)
      : null;

  if (!lastPeriod) {
    return obligations;
  }

  let year = Number(lastPeriod.slice(0, 4));
  let month = Number(lastPeriod.slice(5, 7));

  while (remaining > 0) {
    month += 1;

    if (month > 12) {
      month = 1;
      year += 1;
    }

    if (year === 2020) {
      continue;
    }

    const period = `${year}-${String(month).padStart(2, "0")}-01`;

    if (existingPeriods.has(period)) {
      continue;
    }

    obligations.push({
      period_start: period,
      period_status: "active",
      amount_due_ngn: 500,
      amount_allocated_ngn: 0,
      unresolved: false,
    });

    existingPeriods.add(period);
    remaining -= 500;
  }

  return obligations;
}

async function listMembersWithOutstanding(pool, { search = "", asOf = new Date() } = {}) {
  const searchTerm = search.trim();
  const membersResult = await pool.query(
    `
      SELECT id, full_name, membership_status, regular_dues_start_month
      FROM members
      WHERE ($1::text = '' OR full_name ILIKE $2)
      ORDER BY full_name
      `,
    [searchTerm, `%${searchTerm}%`]
  );

  const duesRows = await loadAllDuesRows(pool);
  const duesByMember = new Map();

  for (const row of duesRows) {
    const existing = duesByMember.get(row.member_id) || [];
    existing.push(row);
    duesByMember.set(row.member_id, existing);
  }

  return membersResult.rows.map((member) => {
    const outstanding = calculateOutstandingBalance(
      member.regular_dues_start_month,
      duesByMember.get(member.id) || [],
      asOf
    );

    return {
      id: member.id,
      full_name: member.full_name,
      membership_status: member.membership_status,
      outstanding_balance_ngn: outstanding,
      financial_status: outstanding > 0 ? "owing" : "up_to_date",
    };
  });
}

async function getDashboardMetrics(pool, asOf = new Date()) {
  const members = await listMembersWithOutstanding(pool, { asOf });

  let financiallyUpToDate = 0;
  let membersOwing = 0;
  let amountOutstanding = 0;

  for (const member of members) {
    amountOutstanding += member.outstanding_balance_ngn;

    if (member.outstanding_balance_ngn > 0) {
      membersOwing += 1;
    } else {
      financiallyUpToDate += 1;
    }
  }

  return {
    financially_committed_members: members.length,
    financially_up_to_date_members: financiallyUpToDate,
    members_owing: membersOwing,
    amount_outstanding_ngn: amountOutstanding,
  };
}

async function getMembersDirectory(pool, {
  search = "",
  status = "all",
  page = 1,
  pageSize = 20,
  asOf = new Date(),
} = {}) {
  let members = await listMembersWithOutstanding(pool, { search, asOf });

  if (status === "owing") {
    members = members.filter((member) => member.outstanding_balance_ngn > 0);
  } else if (status === "up_to_date") {
    members = members.filter((member) => member.outstanding_balance_ngn === 0);
  }

  const size = Math.min(50, Math.max(1, Number(pageSize) || 20));
  const requestedPage = Math.max(1, Number(page) || 1);
  const total = members.length;
  const totalPages = Math.max(1, Math.ceil(total / size) || 1);
  const currentPage = Math.min(requestedPage, total === 0 ? 1 : totalPages);
  const start = (currentPage - 1) * size;

  return {
    members: members.slice(start, start + size),
    total,
    page: currentPage,
    page_size: size,
    total_pages: total === 0 ? 0 : totalPages,
  };
}

module.exports = {
  calculateOutstandingBalance,
  loadMemberDuesRows,
  toMemberDuesPayload,
  calendarPeriodStart,
  toPaymentObligations,
  getDashboardMetrics,
  getMembersDirectory,
};
