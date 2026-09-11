const { savePayment } = require("./payment_writes");

const MONTHLY_DUES_NGN = 500;
const EXCLUDED_YEAR = 2020;
const PERIOD_RE = /^\d{4}-\d{2}-01$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function pad2(value) {
  return String(value).padStart(2, "0");
}

function monthsInclusive(startPeriod, endPeriod) {
  const start = new Date(`${startPeriod}T00:00:00`);
  const end = new Date(`${endPeriod}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    throw new Error("Coverage start must not be after coverage end");
  }

  const months = [];
  let year = start.getFullYear();
  let month = start.getMonth() + 1;
  const endYear = end.getFullYear();
  const endMonth = end.getMonth() + 1;

  while (year < endYear || (year === endYear && month <= endMonth)) {
    if (year !== EXCLUDED_YEAR) {
      months.push(`${year}-${pad2(month)}-01`);
    }
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return months;
}

async function ensureActiveDuesPeriod(client, period) {
  const existing = await client.query(
    `SELECT id FROM dues_periods WHERE period_start = $1 AND period_status = 'active'`,
    [period]
  );
  if (existing.rows.length > 0) return existing.rows[0].id;

  const inserted = await client.query(
    `INSERT INTO dues_periods (period_start, normal_amount_ngn, period_status)
     VALUES ($1, $2, 'active')
     ON CONFLICT (period_start) DO UPDATE SET
       normal_amount_ngn = EXCLUDED.normal_amount_ngn,
       period_status = EXCLUDED.period_status
     RETURNING id`,
    [period, MONTHLY_DUES_NGN]
  );
  if (inserted.rows.length === 0) {
    throw new Error(`No active dues period exists for ${period.slice(0, 7)}.`);
  }
  return inserted.rows[0].id;
}

async function saveNewMember({
  pool,
  firstName,
  lastName,
  duesStartMonth,
  paymentDate,
  amountNgN,
  coverage,
  runPaymentPreview,
  savePaymentFn = savePayment,
}) {
  const first = String(firstName || "").trim();
  const last = String(lastName || "").trim();
  const fullName = `${first} ${last}`.trim();
  const amount = Number(amountNgN);

  if (!first || !last) throw new Error("Enter the member's first and last name.");
  if (!PERIOD_RE.test(duesStartMonth || "")) throw new Error("Enter a valid dues start month.");
  if (!DATE_RE.test(paymentDate || "")) throw new Error("Enter a valid payment date.");
  if (!Number.isInteger(amount) || amount <= 0) throw new Error("Enter a whole payment amount greater than zero.");
  if (!coverage?.start_period || !coverage?.end_period) throw new Error("Select both a coverage start and end month.");
  if (!PERIOD_RE.test(coverage.start_period) || !PERIOD_RE.test(coverage.end_period)) {
    throw new Error("Select both a coverage start and end month.");
  }

  const coverageMonths = monthsInclusive(coverage.start_period, coverage.end_period);
  if (coverageMonths.length * MONTHLY_DUES_NGN !== amount) {
    throw new Error("The amount should clear one or more months.");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const member = await client.query(
      `INSERT INTO members (full_name, regular_dues_start_month, date_added, membership_status, writeoff_2023)
       VALUES ($1, $2, $3, 'active', FALSE)
       RETURNING id, full_name`,
      [fullName, duesStartMonth, paymentDate]
    );
    const memberId = member.rows[0].id;

    for (const period of coverageMonths) {
      const duesPeriodId = await ensureActiveDuesPeriod(client, period);

      await client.query(
        `INSERT INTO member_dues (
          member_id, dues_period_id, original_amount_ngn, writeoff_amount_ngn, amount_due_ngn, source_status
        ) VALUES ($1, $2, $3, 0, $3, 'outstanding')`,
        [memberId, duesPeriodId, MONTHLY_DUES_NGN]
      );
    }

    const payment = await savePaymentFn({
      pool,
      client,
      memberId,
      amountNgN: amount,
      paymentDate,
      noteReference: null,
      coverage,
      runPaymentPreview,
    });

    await client.query("COMMIT");
    return {
      id: memberId,
      full_name: member.rows[0].full_name,
      payment_id: payment.payment_id,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { saveNewMember, monthsInclusive };
