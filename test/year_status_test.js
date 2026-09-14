const assert = require("node:assert/strict");

function due(periodStart, sourceStatus, amountDue = 500, amountAllocated = 0) {
  return {
    period_start: periodStart,
    source_status: sourceStatus,
    amount_due_ngn: amountDue,
    amount_allocated_ngn: amountAllocated,
  };
}

async function run() {
  const { getHistoryYears, getYearStatus, getMonthDisplayStatus } = await import("../frontend/src/yearStatus.js");

  const writeoff2019 = [
    due("2019-01-15T12:00:00.000Z", "writeoff_marker", 300, 0),
    due("2019-06-15T12:00:00.000Z", "writeoff_marker", 300, 0),
    due("2019-12-15T12:00:00.000Z", "writeoff_marker", 300, 0),
  ];

  assert.equal(getYearStatus(2020, writeoff2019, "2021-09-01"), "Excluded");
  assert.equal(getYearStatus(2019, writeoff2019, "2021-09-01"), "Fully paid");
  assert.equal(getYearStatus(2018, writeoff2019, "2021-09-01"), "No dues recorded");

  assert.equal(getMonthDisplayStatus(2019, 1, writeoff2019, "2021-09-01"), "writeoff");
  assert.equal(getMonthDisplayStatus(2019, 6, writeoff2019, "2021-09-01"), "writeoff");
  assert.equal(getMonthDisplayStatus(2019, 12, writeoff2019, "2021-09-01"), "writeoff");

  const mixed2019 = [
    due("2019-01-15T12:00:00.000Z", "writeoff_marker", 300, 0),
    due("2019-05-15T12:00:00.000Z", "writeoff_marker", 300, 0),
    due("2019-06-15T12:00:00.000Z", "paid", 500, 500),
    due("2019-12-15T12:00:00.000Z", "paid", 500, 500),
  ];

  assert.equal(getYearStatus(2019, mixed2019, "2019-06-15T12:00:00.000Z"), "Fully paid");
  assert.equal(getMonthDisplayStatus(2019, 1, mixed2019, "2019-06-15T12:00:00.000Z"), "writeoff");
  assert.equal(getMonthDisplayStatus(2019, 5, mixed2019, "2019-06-15T12:00:00.000Z"), "writeoff");
  assert.equal(getMonthDisplayStatus(2019, 6, mixed2019, "2019-06-15T12:00:00.000Z"), "paid");
  assert.equal(getMonthDisplayStatus(2019, 12, mixed2019, "2019-06-15T12:00:00.000Z"), "paid");

  const outstanding = [due("2024-04-15T12:00:00.000Z", "outstanding", 500, 0)];
  assert.equal(getYearStatus(2024, outstanding, "2021-09-15T12:00:00.000Z"), "Outstanding dues");
  assert.equal(getMonthDisplayStatus(2024, 4, outstanding, "2021-09-15T12:00:00.000Z"), "overdue");
  assert.equal(getMonthDisplayStatus(2021, 8, [], "2021-09-15T12:00:00.000Z"), "not-member");

  const asOf2026 = new Date("2026-09-14T12:00:00.000Z");
  assert.deepEqual(
    getHistoryYears(writeoff2019, asOf2026),
    [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019]
  );
  assert.deepEqual(
    getHistoryYears([due("2022-03-15T12:00:00.000Z", "paid", 500, 500)], asOf2026),
    [2026, 2025, 2024, 2023, 2022]
  );
  assert.deepEqual(
    getHistoryYears([due("2024-01-15T12:00:00.000Z", "outstanding", 500, 0)], asOf2026),
    [2026, 2025, 2024]
  );
  assert.deepEqual(
    getHistoryYears([
      due("2019-01-15T12:00:00.000Z", "writeoff_marker", 300, 0),
      due("2028-06-15T12:00:00.000Z", "paid", 500, 500),
    ], asOf2026),
    [2028, 2027, 2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019]
  );
  assert.deepEqual(getHistoryYears([], asOf2026), [2026]);

  console.log("year and month dues-history status tests passed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
