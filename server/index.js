const express = require("express");
const cors = require("cors");
const pool = require("./db");

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.get("/api/members", async (req, res) => {
  try {
    const search = req.query.search || "";

    const result = await pool.query(
      `
      SELECT id, full_name, membership_status
      FROM members
      WHERE full_name ILIKE $1
      ORDER BY full_name
      LIMIT 20
      `,
      [`%${search}%`]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Member search failed:", error);
    res.status(500).json({ error: "Failed to search members" });
  }
});

app.get("/api/payment-accounts", async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        id,
        bank_name,
        account_name,
        account_number
      FROM payment_accounts
      WHERE is_active = TRUE
      ORDER BY display_order, id
      `
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Payment accounts lookup failed:", error);
    res.status(500).json({ error: "Failed to load payment accounts" });
  }
});

app.get("/api/members/:id", async (req, res) => {
  try {
    const { id } = req.params

    const result = await pool.query(
      `
      SELECT
        id,
        full_name,
        membership_status,
        regular_dues_start_month
      FROM members
      WHERE id = $1
      `,
      [id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Member not found" })
    }

    res.json(result.rows[0])
  } catch (error) {
    console.error("Member lookup failed:", error)
    res.status(500).json({ error: "Failed to load member" })
  }
})

app.get("/api/members/:id/dues", async (req, res) => {
  try {
    const { id } = req.params;

const memberResult = await pool.query(
  `SELECT regular_dues_start_month FROM members WHERE id = $1`,
  [id]
);

const duesStartMonth = memberResult.rows[0]?.regular_dues_start_month;

    const result = await pool.query(
      `
      SELECT 
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
WHERE md.member_id = $1
 AND (
  dp.period_start < '2020-01-01'
  OR dp.period_start >= '2021-01-01'
)
GROUP BY
  dp.period_start,
  dp.period_status,
  md.amount_due_ngn,
  md.source_status
ORDER BY dp.period_start
      `,
      [id]
    );

    const currentDate = new Date();
const currentYear = currentDate.getFullYear();
const currentMonth = currentDate.getMonth() + 1;

const startDate = duesStartMonth
  ? new Date(duesStartMonth)
  : null;

  const duesByMonth = new Map(
  result.rows.map((due) => {
    const periodDate = new Date(due.period_start);
    const monthKey = `${periodDate.getFullYear()}-${String(
      periodDate.getMonth() + 1
    ).padStart(2, "0")}`;

    return [monthKey, due];
  })
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
      const monthKey = `${year}-${String(month).padStart(2, "0")}`;
      const due = duesByMonth.get(monthKey);

      if (due) {
        // Historical write-off records are already settled
        if (due.source_status !== "writeoff_marker") {
          const unpaidAmount =
            Number(due.amount_due_ngn) -
            Number(due.amount_allocated_ngn);

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

const visibleDues = startDate
  ? result.rows.filter((due) => {
      const periodDate = new Date(due.period_start);
      return periodDate >= startDate;
    })
  : result.rows;

res.json({
  dues: result.rows,
  outstanding_balance_ngn: outstandingBalance,
  regular_dues_start_month: duesStartMonth
});

  } catch (error) {
    console.error("Member dues lookup failed:", error);
    res.status(500).json({ error: "Failed to load member dues" });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`GVAC API running at http://192.168.101.18:${PORT}`);
});
