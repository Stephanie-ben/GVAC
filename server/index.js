const express = require("express");
const cors = require("cors");
const pool = require("./db");
const {
  calculateOutstandingBalance,
  loadMemberDuesRows,
  toMemberDuesPayload,
  getDashboardMetrics,
  getMembersDirectory,
} = require("./outstanding");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get("/api/members", async (req, res) => {
  try {
    const search = req.query.search || "";

    if (req.query.page === undefined) {
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

      return res.json(result.rows);
    }

    const page = Number.parseInt(req.query.page, 10);
    const pageSize = Number.parseInt(req.query.page_size, 10);
    const status = req.query.status || "all";

    const directory = await getMembersDirectory(pool, {
      search,
      status,
      page: Number.isFinite(page) ? page : 1,
      pageSize: Number.isFinite(pageSize) ? pageSize : 20,
    });

    res.json(directory);
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

app.get("/api/admin/dashboard", async (req, res) => {
  try {
    const metrics = await getDashboardMetrics(pool);
    res.json(metrics);
  } catch (error) {
    console.error("Admin dashboard lookup failed:", error);
    res.status(500).json({ error: "Failed to load dashboard" });
  }
});

app.get("/api/members/:id/dues", async (req, res) => {
  try {
    const { id } = req.params;

const memberResult = await pool.query(
  `SELECT regular_dues_start_month FROM members WHERE id = $1`,
  [id]
);

const duesStartMonth = memberResult.rows[0]?.regular_dues_start_month;

    const resultRows = await loadMemberDuesRows(pool, id);
    const outstandingBalance = calculateOutstandingBalance(
      duesStartMonth,
      resultRows
    );

const startDate = duesStartMonth
  ? new Date(duesStartMonth)
  : null;

const visibleDues = startDate
  ? resultRows.filter((due) => {
      const periodDate = new Date(due.period_start);
      return periodDate >= startDate;
    })
  : resultRows;

res.json({
  dues: toMemberDuesPayload(resultRows),
  outstanding_balance_ngn: outstandingBalance,
  regular_dues_start_month: duesStartMonth
});

  } catch (error) {
    console.error("Member dues lookup failed:", error);
    res.status(500).json({ error: "Failed to load member dues" });
  }
});

app.listen(PORT, "0.0.0.0", () => {
   console.log(`GVAC API running on port ${PORT}`);
});
