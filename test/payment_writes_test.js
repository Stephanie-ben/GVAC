const assert = require("node:assert/strict");
const { savePayment, periodKey } = require("../server/payment_writes");

function due(allocated, periodStart = "2026-08-01") {
  return {
    member_dues_id: "due-1",
    period_start: periodStart,
    period_status: "active",
    amount_due_ngn: 500,
    amount_allocated_ngn: allocated,
    source_status: "outstanding",
  };
}

function createPool({
  previewValid = true,
  outstandingAfter = 0,
  periodStart = "2026-08-01",
} = {}) {
  const statements = [];
  const client = {
    async query(sql) {
      statements.push(sql);
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") return { rows: [] };
      if (sql.includes("FROM members")) return { rows: [{ id: "member-1", regular_dues_start_month: "2026-08-01" }] };
      if (sql.includes("SELECT id FROM member_dues")) return { rows: [] };
      if (sql.includes("unresolved_historical_periods")) return { rows: [] };
      if (sql.includes("FROM member_dues md")) return { rows: [due(0, periodStart)] };
      if (sql.includes("INSERT INTO payments")) return { rows: [{ id: "payment-1" }] };
      if (sql.includes("INSERT INTO dues_allocations")) return { rows: [] };
      throw new Error(`Unexpected query: ${sql}`);
    },
    release() { statements.push("RELEASE"); },
  };

  return {
    statements,
    pool: { async connect() { return client; } },
    runPaymentPreview: async () => ({
      valid: previewValid,
      allocations: [{ period_start: "2026-08-01", amount_allocated_ngn: 500 }],
      outstanding_after_ngn: outstandingAfter,
    }),
  };
}

async function run() {
  assert.equal(periodKey("2026-08-01"), "2026-08-01");
  assert.equal(periodKey(new Date(2026, 7, 1)), "2026-08-01");
  assert.equal(periodKey(new Date(2024, 3, 1)), "2024-04-01");

  const success = createPool({ outstandingAfter: 1500 });
  const result = await savePayment({
    pool: success.pool,
    memberId: "member-1",
    amountNgN: 500,
    paymentDate: "2026-08-31",
    noteReference: "REF-001",
    coverage: { start_period: "2026-08-01", end_period: "2026-08-01" },
    runPaymentPreview: success.runPaymentPreview,
  });
  assert.equal(result.payment_id, "payment-1");
  assert.equal(result.outstanding_balance_ngn, 1500);
  assert.ok(success.statements.some((sql) => sql.includes("INSERT INTO payments")));
  assert.ok(success.statements.some((sql) => sql.includes("INSERT INTO dues_allocations")));
  assert.ok(success.statements.includes("COMMIT"));
  assert.ok(!success.statements.includes("ROLLBACK"));
  assert.equal(success.statements.filter((sql) => sql.includes("FROM member_dues md")).length, 1);

  const datePeriod = createPool({
    outstandingAfter: 0,
    periodStart: new Date("2026-08-01T00:00:00.000Z"),
  });
  const dateResult = await savePayment({
    pool: datePeriod.pool,
    memberId: "member-1",
    amountNgN: 500,
    paymentDate: "2026-08-31",
    coverage: { start_period: "2026-08-01", end_period: "2026-08-01" },
    runPaymentPreview: datePeriod.runPaymentPreview,
  });
  assert.equal(dateResult.payment_id, "payment-1");

  const invalidCoverage = createPool({ previewValid: false });
  await assert.rejects(
    savePayment({
      pool: invalidCoverage.pool,
      memberId: "member-1",
      amountNgN: 500,
      paymentDate: "2026-08-31",
      coverage: { start_period: "2026-08-01", end_period: "2026-08-01" },
      runPaymentPreview: invalidCoverage.runPaymentPreview,
    }),
    /coverage does not match/
  );
  assert.ok(invalidCoverage.statements.includes("ROLLBACK"));
  assert.ok(!invalidCoverage.statements.some((sql) => sql.includes("INSERT INTO payments")));

  console.log("payment write transaction tests passed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
