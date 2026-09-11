const assert = require("node:assert/strict");

async function run() {
  const { memberAnalyticsPath } = await import("../frontend/src/analytics.js");

  assert.equal(memberAnalyticsPath("/"), "/");
  assert.equal(memberAnalyticsPath("/members"), "/members");
  assert.equal(memberAnalyticsPath("/members/ecff9851-3cd7-4e36-834e-01ea8ac9c00e"), "/members");
  assert.equal(memberAnalyticsPath("/members/ecff9851-3cd7-4e36-834e-01ea8ac9c00e?search=Ada"), "/members");
  assert.equal(memberAnalyticsPath("/admin"), null);
  assert.equal(memberAnalyticsPath("/admin/members/123"), null);
  assert.equal(memberAnalyticsPath("/admin?added=Ada%20Okoro"), null);

  console.log("member analytics path sanitization tests passed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
