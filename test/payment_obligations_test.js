const assert = require("node:assert/strict");
const {
  calendarPeriodStart,
  toPaymentObligations,
} = require("../server/outstanding");
const { previewPayment } = require("../server/payment_preview");

function runPaymentPreview(payload) {
  return Promise.resolve().then(() => previewPayment(payload));
}

function due({ period, status, amount = 500, allocated = 0 }) {
  const [year, month] = period.split("-").map(Number);
  return {
    period_start: new Date(year, month - 1, 1),
    period_status: "active",
    amount_due_ngn: amount,
    amount_allocated_ngn: allocated,
    source_status: status,
  };
}

async function run() {
  assert.equal(calendarPeriodStart("2024-04-01"), "2024-04-01");
  assert.equal(calendarPeriodStart(new Date(2024, 3, 1)), "2024-04-01");
  assert.equal(calendarPeriodStart(new Date(2022, 0, 1)), "2022-01-01");

  const ihezue = toPaymentObligations(
    [
      due({ period: "2021-12", status: "paid", allocated: 500 }),
      due({ period: "2022-01", status: "writeoff_marker", amount: 300 }),
      due({ period: "2022-11", status: "writeoff_marker", amount: 300 }),
      due({ period: "2024-04", status: "outstanding" }),
      due({ period: "2024-05", status: "outstanding" }),
    ],
    "2018-07-01"
  );
  assert.deepEqual(
    ihezue.map((row) => row.period_start),
    ["2024-04-01", "2024-05-01"]
  );

  const ihezue500 = await runPaymentPreview({
    amount_ngn: 500,
    as_of: "2024-05-01",
    obligations: ihezue,
  });
  assert.equal(ihezue500.coverage.start_period, "2024-04-01");
  assert.equal(ihezue500.coverage.end_period, "2024-04-01");
  assert.deepEqual(ihezue500.allocations, [
    { period_start: "2024-04-01", amount_allocated_ngn: 500 },
  ]);

  const ihezue1000 = await runPaymentPreview({
    amount_ngn: 1000,
    as_of: "2024-05-01",
    obligations: ihezue,
  });
  assert.equal(ihezue1000.coverage.start_period, "2024-04-01");
  assert.equal(ihezue1000.coverage.end_period, "2024-05-01");

  await assert.rejects(
    runPaymentPreview({ amount_ngn: 300, obligations: ihezue }),
    /partial payment/
  );

  const laterJoiner = toPaymentObligations(
    [
      due({ period: "2024-01", status: "outstanding" }),
      due({ period: "2024-02", status: "outstanding" }),
      due({ period: "2024-03", status: "paid", allocated: 500 }),
      due({ period: "2024-06", status: "outstanding" }),
      due({ period: "2024-07", status: "outstanding" }),
    ],
    "2024-03-01"
  );
  assert.deepEqual(
    laterJoiner.map((row) => row.period_start),
    ["2024-06-01", "2024-07-01"]
  );

  const later500 = await runPaymentPreview({
    amount_ngn: 500,
    as_of: "2024-07-01",
    obligations: laterJoiner,
  });
  assert.equal(later500.coverage.start_period, "2024-06-01");
  assert.equal(later500.coverage.end_period, "2024-06-01");

  const later1000 = await runPaymentPreview({
    amount_ngn: 1000,
    as_of: "2024-07-01",
    obligations: laterJoiner,
  });
  assert.equal(later1000.coverage.start_period, "2024-06-01");
  assert.equal(later1000.coverage.end_period, "2024-07-01");

  const writeoffLaterStart = toPaymentObligations(
    [
      due({ period: "2018-01", status: "writeoff_marker", amount: 300 }),
      due({ period: "2021-03", status: "paid", allocated: 500 }),
      due({ period: "2022-02", status: "outstanding" }),
    ],
    new Date(2021, 2, 1)
  );
  assert.deepEqual(
    writeoffLaterStart.map((row) => row.period_start),
    ["2022-02-01"]
  );

  console.log("payment obligation mapping tests passed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
