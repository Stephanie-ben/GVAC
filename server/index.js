const express = require("express");
const cors = require("cors");
const { spawn } = require("child_process");
const path = require("path");
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

function runPaymentPreview(payload) {
  return new Promise((resolve, reject) => {
    const preview = spawn("ruby", [path.join(__dirname, "../lib/payment_preview.rb")]);
    let output = "";
    let errorOutput = "";

    preview.stdout.on("data", (chunk) => { output += chunk; });
    preview.stderr.on("data", (chunk) => { errorOutput += chunk; });
    preview.on("error", reject);
    preview.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(errorOutput.trim() || "Unable to calculate payment coverage"));
        return;
      }

      try {
        resolve(JSON.parse(output));
      } catch (error) {
        reject(error);
      }
    });
    preview.stdin.end(JSON.stringify(payload));
  });
}

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

app.post("/api/admin/members/:id/payment-preview", async (req, res) => {
  try {
    const amount = Number(req.body.amount_ngn);
    if (!Number.isInteger(amount) || amount <= 0) {
      return res.status(422).json({ error: "Enter a whole payment amount greater than zero." });
    }

    const { id } = req.params;
    const dues = await loadMemberDuesRows(pool, id);
    const unresolved = await pool.query(
      `SELECT period_start FROM unresolved_historical_periods WHERE member_id = $1`,
      [id]
    );
    const coverage = req.body.coverage;
    if (coverage && (!coverage.start_period || !coverage.end_period)) {
      return res.status(422).json({ error: "Select both a coverage start and end month." });
    }

    const preview = await runPaymentPreview({
      amount_ngn: amount,
      obligations: [
        ...dues,
        ...unresolved.rows.map((row) => ({
          period_start: row.period_start,
          period_status: "active",
          amount_due_ngn: 0,
          amount_allocated_ngn: 0,
          unresolved: true,
        })),
      ],
      coverage,
    });

    res.json(preview);
  } catch (error) {
    console.error("Payment coverage preview failed:", error);
    res.status(422).json({
      error: "The amount must exactly clear whole outstanding monthly dues.",
    });
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
