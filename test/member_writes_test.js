const assert = require("node:assert/strict");
const { saveNewMember, monthsInclusive } = require("../server/member_writes");

function createPool({ failAfterMember = false, missingPeriods = [] } = {}) {
  const statements = [];
  const client = {
    async query(sql, params) {
      statements.push(sql);
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") return { rows: [] };
      if (sql.includes("INSERT INTO members")) {
        if (failAfterMember) throw new Error("member insert failed");
        return { rows: [{ id: "member-1", full_name: params[0] }] };
      }
      if (sql.includes("INSERT INTO dues_periods")) {
        return { rows: [{ id: `created-${params[0]}` }] };
      }
      if (sql.includes("FROM dues_periods")) {
        if (missingPeriods.includes(params[0])) return { rows: [] };
        return { rows: [{ id: "period-1" }] };
      }
      if (sql.includes("INSERT INTO member_dues")) return { rows: [] };
      throw new Error(`Unexpected query: ${sql}`);
    },
    release() { statements.push("RELEASE"); },
  };

  return {
    statements,
    pool: { async connect() { return client; } },
  };
}

async function run() {
  assert.deepEqual(monthsInclusive("2026-09-01", "2026-10-01"), ["2026-09-01", "2026-10-01"]);
  assert.deepEqual(monthsInclusive("2019-11-01", "2021-01-01"), ["2019-11-01", "2019-12-01", "2021-01-01"]);

  const success = createPool();
  let savedPayment = null;
  const result = await saveNewMember({
    pool: success.pool,
    firstName: "Ada",
    lastName: "Okoro",
    duesStartMonth: "2026-09-01",
    paymentDate: "2026-09-07",
    amountNgN: 1000,
    coverage: { start_period: "2026-09-01", end_period: "2026-10-01" },
    runPaymentPreview: async () => ({}),
    savePaymentFn: async (args) => {
      savedPayment = args;
      return { payment_id: "payment-1" };
    },
  });

  assert.equal(result.id, "member-1");
  assert.equal(result.full_name, "Ada Okoro");
  assert.equal(result.payment_id, "payment-1");
  assert.equal(savedPayment.memberId, "member-1");
  assert.equal(savedPayment.client !== undefined, true);
  assert.ok(success.statements.some((sql) => sql.includes("INSERT INTO members")));
  assert.equal(success.statements.filter((sql) => sql.includes("INSERT INTO member_dues")).length, 2);
  assert.ok(success.statements.includes("COMMIT"));
  assert.ok(!success.statements.includes("ROLLBACK"));

  const failed = createPool({ failAfterMember: true });
  await assert.rejects(
    saveNewMember({
      pool: failed.pool,
      firstName: "Ada",
      lastName: "Okoro",
      duesStartMonth: "2026-09-01",
      paymentDate: "2026-09-07",
      amountNgN: 1000,
      coverage: { start_period: "2026-09-01", end_period: "2026-10-01" },
      savePaymentFn: async () => ({ payment_id: "payment-1" }),
    }),
    /member insert failed/
  );
  assert.ok(failed.statements.includes("ROLLBACK"));
  assert.ok(!failed.statements.includes("COMMIT"));

  const future = createPool({ missingPeriods: ["2038-08-01"] });
  const futureResult = await saveNewMember({
    pool: future.pool,
    firstName: "Ada",
    lastName: "Okoro",
    duesStartMonth: "2038-08-01",
    paymentDate: "2026-09-07",
    amountNgN: 500,
    coverage: { start_period: "2038-08-01", end_period: "2038-08-01" },
    runPaymentPreview: async () => ({}),
    savePaymentFn: async () => ({ payment_id: "payment-1" }),
  });
  assert.equal(futureResult.payment_id, "payment-1");
  assert.ok(future.statements.some((sql) => sql.includes("INSERT INTO dues_periods")));
  assert.ok(future.statements.includes("COMMIT"));

  console.log("member write transaction tests passed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
