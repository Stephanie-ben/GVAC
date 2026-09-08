const {
  loadMemberDuesRows,
  calendarPeriodStart,
  toPaymentObligations,
} = require("./outstanding");

function periodKey(periodStart) {
  return calendarPeriodStart(periodStart);
}

async function savePayment({
  pool,
  client: existingClient,
  memberId,
  amountNgN,
  paymentDate,
  noteReference,
  coverage,
  runPaymentPreview,
}) {
  const client = existingClient || await pool.connect();
  const managesTransaction = !existingClient;

  try {
    if (managesTransaction) await client.query("BEGIN");

    const member = await client.query(
      `SELECT id, regular_dues_start_month FROM members WHERE id = $1 FOR UPDATE`,
      [memberId]
    );
    if (member.rows.length === 0) throw new Error("Member not found");

    await client.query(`SELECT id FROM member_dues WHERE member_id = $1 FOR UPDATE`, [memberId]);
    const dues = await loadMemberDuesRows(client, memberId);
    const preview = await runPaymentPreview({
      amount_ngn: amountNgN,
    obligations: toPaymentObligations(
      dues,
      member.rows[0].regular_dues_start_month,
      amountNgN
    ),
      coverage,
    });

    if (!preview.valid) {
      throw new Error("Selected coverage does not match the oldest outstanding months this payment would clear");
    }
    if (!Array.isArray(preview.allocations) || preview.allocations.length === 0) {
      throw new Error("Payment produced no allocations");
    }
    if (!Number.isInteger(preview.outstanding_after_ngn) || preview.outstanding_after_ngn < 0) {
      throw new Error("Unable to calculate outstanding balance");
    }

    const payment = await client.query(
      `INSERT INTO payments (member_id, amount_ngn, payment_date, note_reference)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [memberId, amountNgN, paymentDate, noteReference || null]
    );

const duesByPeriod = new Map(
  dues.map((due) => [periodKey(due.period_start), due])
);

for (const allocation of preview.allocations) {
  const allocated = Number(allocation.amount_allocated_ngn);

  if (!Number.isInteger(allocated) || allocated <= 0) {
    throw new Error("Allocation amount is invalid");
  }

  const allocationPeriod = periodKey(allocation.period_start);
  let due = duesByPeriod.get(allocationPeriod);

  if (!due) {
    const duesPeriod = await client.query(
      `SELECT id
       FROM dues_periods
       WHERE period_start = $1
         AND period_status = 'active'`,
      [allocation.period_start]
    );

    if (duesPeriod.rows.length === 0) {
      throw new Error(
        `No active dues period exists for ${allocationPeriod}.`
      );
    }

    const newDue = await client.query(
      `INSERT INTO member_dues (
        member_id,
        dues_period_id,
        original_amount_ngn,
        writeoff_amount_ngn,
        amount_due_ngn,
        source_status
      ) VALUES ($1, $2, $3, 0, $3, 'outstanding')
      RETURNING id, member_id, amount_due_ngn, source_status`,
      [
        memberId,
        duesPeriod.rows[0].id,
        500,
      ]
    );

    due = {
      member_dues_id: newDue.rows[0].id,
      member_id: newDue.rows[0].member_id,
      period_start: allocation.period_start,
      amount_due_ngn: Number(newDue.rows[0].amount_due_ngn),
      amount_allocated_ngn: 0,
      source_status: newDue.rows[0].source_status,
    };

    duesByPeriod.set(allocationPeriod, due);
  }

  await client.query(
    `INSERT INTO dues_allocations (
      member_dues_id,
      payment_id,
      amount_allocated_ngn,
      allocation_kind
    ) VALUES ($1, $2, $3, 'live_payment')`,
    [due.member_dues_id, payment.rows[0].id, allocated]
  );
}
    if (managesTransaction) await client.query("COMMIT");
    return {
      payment_id: payment.rows[0].id,
      outstanding_balance_ngn: preview.outstanding_after_ngn,
    };
  } catch (error) {
    if (managesTransaction) await client.query("ROLLBACK");
    throw error;
  } finally {
    if (managesTransaction) client.release();
  }
}

module.exports = { savePayment, periodKey };
