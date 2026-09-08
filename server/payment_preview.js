const { calendarPeriodStart } = require("./outstanding");

const EXCLUDED_YEAR = 2020;

function month(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}$/.test(value)) {
    return calendarPeriodStart(`${value}-01`);
  }

  return calendarPeriodStart(value);
}

function remaining(due) {
  return Math.max(Number(due.amount_due_ngn) - Number(due.amount_allocated_ngn), 0);
}

function isExcluded(due) {
  const period = month(due.period_start);
  return Boolean(due.excluded) || due.period_status === "excluded" || period.startsWith(`${EXCLUDED_YEAR}-`);
}

function allocateOldestFirst(obligations, paymentAmountNgN) {
  let remainingPayment = paymentAmountNgN;
  const allocations = [];
  const sorted = [...obligations].sort((left, right) => (
    month(left.period_start).localeCompare(month(right.period_start))
  ));

  for (const due of sorted) {
    if (isExcluded(due) || due.unresolved || remaining(due) === 0) continue;

    const required = remaining(due);
    if (remainingPayment < required) break;

    allocations.push({ due, amount_allocated_ngn: required });
    remainingPayment -= required;
  }

  if (remainingPayment !== 0) {
    throw new Error("payment cannot be allocated without a partial payment");
  }

  return allocations;
}

function allocationCoverage(allocations) {
  if (!allocations.length) {
    throw new Error("payment produced no allocations");
  }

  return {
    start_period: month(allocations[0].due.period_start),
    end_period: month(allocations[allocations.length - 1].due.period_start),
    amount_ngn: allocations.reduce((sum, item) => sum + item.amount_allocated_ngn, 0),
  };
}

function coverageMatchesAllocation(allocations, startPeriod, endPeriod) {
  const span = allocationCoverage(allocations);
  return month(startPeriod) === span.start_period && month(endPeriod) === span.end_period;
}

function coverageAmount(obligations, startPeriod, endPeriod) {
  const startDate = month(startPeriod);
  const endDate = month(endPeriod);
  if (startDate > endDate) {
    throw new Error("coverage start must not be after coverage end");
  }

  return obligations.reduce((sum, due) => {
    const period = month(due.period_start);
    if (isExcluded(due) || due.unresolved || period < startDate || period > endDate) {
      return sum;
    }

    return sum + remaining(due);
  }, 0);
}

function outstanding(obligations, asOf) {
  const cutoff = month(asOf);
  return obligations.reduce((sum, due) => {
    if (isExcluded(due) || due.unresolved || month(due.period_start) > cutoff) {
      return sum;
    }

    return sum + remaining(due);
  }, 0);
}

function currentMonthStart() {
  const now = new Date();
  return month(new Date(now.getFullYear(), now.getMonth(), 1));
}

function previewPayment(payload) {
  const amount = Number(payload.amount_ngn);
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("payment amount must be positive");
  }

  const obligations = (payload.obligations || []).map((row) => ({
    period_start: month(row.period_start),
    period_status: row.period_status,
    amount_due_ngn: Number(row.amount_due_ngn),
    amount_allocated_ngn: Number(row.amount_allocated_ngn),
    excluded: row.excluded,
    unresolved: Boolean(row.unresolved),
  }));

  const allocations = allocateOldestFirst(obligations, amount);
  const proposed = allocationCoverage(allocations);
  const asOf = payload.as_of ? month(payload.as_of) : currentMonthStart();

  const updatedObligations = obligations.map((due) => {
    const added = allocations.reduce((sum, item) => (
      item.due === due ? sum + item.amount_allocated_ngn : sum
    ), 0);

    return {
      ...due,
      amount_allocated_ngn: due.amount_allocated_ngn + added,
    };
  });

  const allocationPayload = allocations.map((item) => ({
    period_start: month(item.due.period_start),
    amount_allocated_ngn: item.amount_allocated_ngn,
  }));

  const coverage = payload.coverage;
  let startPeriod;
  let endPeriod;
  let selectedAmount;
  let valid;

  if (coverage) {
    startPeriod = month(coverage.start_period);
    endPeriod = month(coverage.end_period);
    selectedAmount = coverageAmount(obligations, startPeriod, endPeriod);
    valid = coverageMatchesAllocation(allocations, startPeriod, endPeriod);
  } else {
    startPeriod = proposed.start_period;
    endPeriod = proposed.end_period;
    selectedAmount = proposed.amount_ngn;
    valid = true;
  }

  return {
    valid,
    amount_ngn: amount,
    coverage: {
      start_period: startPeriod,
      end_period: endPeriod,
      amount_ngn: selectedAmount,
    },
    proposed_coverage: {
      start_period: proposed.start_period,
      end_period: proposed.end_period,
      amount_ngn: proposed.amount_ngn,
    },
    allocations: allocationPayload,
    outstanding_after_ngn: outstanding(updatedObligations, asOf),
  };
}

module.exports = {
  EXCLUDED_YEAR,
  month,
  remaining,
  allocateOldestFirst,
  allocationCoverage,
  coverageMatchesAllocation,
  coverageAmount,
  outstanding,
  previewPayment,
};
