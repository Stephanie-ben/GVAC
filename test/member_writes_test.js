const assert = require("node:assert/strict");
const { saveNewMember, updateMember, monthsInclusive } = require("../server/member_writes");

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

  const updateClient = {
    statements: [],
    params: [],
    async query(sql, params = []) {
      this.statements.push(sql);
      this.params.push(params);
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") return { rows: [] };
      if (sql.includes("FROM members") && sql.includes("FOR UPDATE")) {
        return { rows: [{ id: "member-1", full_name: "OLD NAME", regular_dues_start_month: "2019-01-01" }] };
      }
      if (sql.includes("UPDATE members")) return { rows: [] };
      if (sql.includes("DELETE FROM dues_allocations")) return { rows: [] };
      if (sql.includes("DELETE FROM member_dues")) return { rows: [] };
      throw new Error(`Unexpected query: ${sql}`);
    },
    release() { this.statements.push("RELEASE"); },
  };

  const renamed = await updateMember({
    pool: { async connect() { return updateClient; } },
    memberId: "member-1",
    fullName: "  New   Name  ",
    duesStartMonth: "2019-01-01",
  });
  assert.equal(renamed.id, "member-1");
  assert.equal(renamed.full_name, "New Name");
  assert.equal(renamed.regular_dues_start_month, "2019-01-01");
  const nameUpdate = updateClient.params.find((params) => params[1] === "New Name");
  assert.deepEqual(nameUpdate, ["member-1", "New Name", "2019-01-01"]);
  assert.ok(updateClient.statements.includes("COMMIT"));

  const startClient = {
    statements: [],
    params: [],
    async query(sql, params = []) {
      this.statements.push(sql);
      this.params.push(params);
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") return { rows: [] };
      if (sql.includes("FROM members") && sql.includes("FOR UPDATE")) {
        return { rows: [{ id: "member-2" }] };
      }
      if (sql.includes("UPDATE members")) return { rows: [] };
      if (sql.includes("DELETE FROM dues_allocations")) return { rows: [] };
      if (sql.includes("DELETE FROM member_dues")) return { rows: [] };
      throw new Error(`Unexpected query: ${sql}`);
    },
    release() { this.statements.push("RELEASE"); },
  };

  const movedStart = await updateMember({
    pool: { async connect() { return startClient; } },
    memberId: "member-2",
    fullName: "ANYANWU HENRY",
    duesStartMonth: "2019-06-01",
  });
  assert.equal(movedStart.id, "member-2");
  assert.equal(movedStart.regular_dues_start_month, "2019-06-01");
  assert.ok(startClient.statements.some((sql) => sql.includes("DELETE FROM dues_allocations")));
  assert.ok(startClient.statements.some((sql) => sql.includes("DELETE FROM member_dues")));
  const startDelete = startClient.params.find((params) => params[1] === "2019-06-01" && params.length === 2 && params[0] === "member-2");
  assert.ok(startDelete);
  assert.ok(!startClient.statements.some((sql) => sql.includes("DELETE FROM payments")));
  assert.ok(startClient.statements.includes("COMMIT"));

  const missing = {
    statements: [],
    async query(sql) {
      this.statements.push(sql);
      if (sql === "BEGIN" || sql === "ROLLBACK") return { rows: [] };
      if (sql.includes("FROM members")) return { rows: [] };
      throw new Error(`Unexpected query: ${sql}`);
    },
    release() { this.statements.push("RELEASE"); },
  };
  await assert.rejects(
    updateMember({
      pool: { async connect() { return missing; } },
      memberId: "missing",
      fullName: "NOPE",
      duesStartMonth: "2019-06-01",
    }),
    /Member not found/
  );
  assert.ok(missing.statements.includes("ROLLBACK"));

  console.log("member write transaction tests passed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
