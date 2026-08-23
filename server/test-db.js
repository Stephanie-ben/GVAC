const pool = require("./db");

async function testDatabase() {
  try {
    const result = await pool.query(`
      SELECT id, full_name, membership_status
      FROM members
      ORDER BY full_name
      LIMIT 5
    `);

    console.log("Members found:");
    console.table(result.rows);
  } catch (error) {
    console.error("Database query failed:", error.message);
  } finally {
    await pool.end();
  }
}

testDatabase();
