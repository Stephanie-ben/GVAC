const assert = require("node:assert/strict");
const { previewPayment } = require("../server/payment_preview");
const { toPaymentObligations } = require("../server/outstanding");

function obligation(periodStart, amountDue, allocated = 0) {
  return {
    period_start: periodStart,
    period_status: "active",
    amount_due_ngn: amountDue,
    amount_allocated_ngn: allocated,
    unresolved: false,
  };
}

function dueRow(period, amount = 500, allocated = 0, status = "outstanding") {
  const [year, month] = period.split("-").map(Number);
  return {
    period_start: new Date(year, month - 1, 1),
    period_status: "active",
    amount_due_ngn: amount,
    amount_allocated_ngn: allocated,
    source_status: status,
  };
}

function run() {
  const oneMonth = previewPayment({
    amount_ngn: 500,
    as_of: "2024-01-01",
    obligations: [obligation("2024-01-01", 500)],
  });
  assert.equal(oneMonth.valid, true);
  assert.equal(oneMonth.coverage.start_period, "2024-01-01");
  assert.equal(oneMonth.coverage.end_period, "2024-01-01");
  assert.equal(oneMonth.coverage.amount_ngn, 500);
  assert.deepEqual(oneMonth.allocations, [
    { period_start: "2024-01-01", amount_allocated_ngn: 500 },
  ]);
  assert.equal(oneMonth.outstanding_after_ngn, 0);

  const twoMonths = previewPayment({
    amount_ngn: 1000,
    as_of: "2024-03-01",
    obligations: [
      obligation("2024-01-01", 500),
      obligation("2024-02-01", 500),
      obligation("2024-03-01", 500),
      obligation("2024-04-01", 500),
    ],
  });
  assert.equal(twoMonths.valid, true);
  assert.equal(twoMonths.coverage.start_period, "2024-01-01");
  assert.equal(twoMonths.coverage.end_period, "2024-02-01");
  assert.equal(twoMonths.coverage.amount_ngn, 1000);
  assert.deepEqual(twoMonths.proposed_coverage, twoMonths.coverage);
  assert.deepEqual(twoMonths.allocations, [
    { period_start: "2024-01-01", amount_allocated_ngn: 500 },
    { period_start: "2024-02-01", amount_allocated_ngn: 500 },
  ]);
  assert.equal(twoMonths.outstanding_after_ngn, 500);

  const futureObligations = toPaymentObligations(
    [dueRow("2026-08", 500)],
    "2026-08-01",
    17000
  );
  const seventeenThousand = previewPayment({
    amount_ngn: 17000,
    as_of: "2026-08-01",
    obligations: futureObligations,
  });
  assert.equal(seventeenThousand.valid, true);
  assert.equal(seventeenThousand.coverage.start_period, "2026-08-01");
  assert.equal(seventeenThousand.coverage.end_period, "2029-05-01");
  assert.equal(seventeenThousand.coverage.amount_ngn, 17000);
  assert.equal(seventeenThousand.allocations.length, 34);
  assert.equal(seventeenThousand.allocations[0].amount_allocated_ngn, 500);
  assert.equal(seventeenThousand.allocations.at(-1).period_start, "2029-05-01");
  assert.equal(seventeenThousand.outstanding_after_ngn, 0);

  assert.throws(
    () => previewPayment({
      amount_ngn: 300,
      obligations: [obligation("2024-01-01", 500)],
    }),
    /partial payment/
  );
  assert.throws(
    () => previewPayment({
      amount_ngn: 700,
      obligations: [obligation("2024-01-01", 500), obligation("2024-02-01", 500)],
    }),
    /partial payment/
  );

  const adjusted = previewPayment({
    amount_ngn: 300,
    as_of: "2024-01-01",
    obligations: [
      obligation("2023-12-01", 300),
      obligation("2024-01-01", 500),
    ],
  });
  assert.equal(adjusted.valid, true);
  assert.deepEqual(adjusted.allocations, [
    { period_start: "2023-12-01", amount_allocated_ngn: 300 },
  ]);
  assert.equal(adjusted.outstanding_after_ngn, 500);

  const skippedExcluded = previewPayment({
    amount_ngn: 500,
    as_of: "2021-01-01",
    obligations: [
      obligation("2019-12-01", 500, 500),
      {
        period_start: "2020-06-01",
        period_status: "excluded",
        amount_due_ngn: 0,
        amount_allocated_ngn: 0,
        unresolved: false,
      },
      obligation("2021-01-01", 500),
    ],
  });
  assert.equal(skippedExcluded.coverage.start_period, "2021-01-01");
  assert.equal(skippedExcluded.coverage.end_period, "2021-01-01");

  const matchingCoverage = previewPayment({
    amount_ngn: 1000,
    as_of: "2024-03-01",
    obligations: [
      obligation("2024-01-01", 500),
      obligation("2024-02-01", 500),
      obligation("2024-03-01", 500),
    ],
    coverage: { start_period: "2024-01-01", end_period: "2024-02-01" },
  });
  assert.equal(matchingCoverage.valid, true);

  const mismatchedCoverage = previewPayment({
    amount_ngn: 1000,
    as_of: "2024-04-01",
    obligations: [
      obligation("2024-01-01", 500),
      obligation("2024-02-01", 500),
      obligation("2024-03-01", 500, 500),
      obligation("2024-04-01", 500, 500),
    ],
    coverage: { start_period: "2024-01-01", end_period: "2024-04-01" },
  });
  assert.equal(mismatchedCoverage.valid, false);
  assert.equal(mismatchedCoverage.proposed_coverage.start_period, "2024-01-01");
  assert.equal(mismatchedCoverage.proposed_coverage.end_period, "2024-02-01");

  console.log("payment preview tests passed");
}

run();
