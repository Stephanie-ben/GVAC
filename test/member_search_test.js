const assert = require("node:assert/strict");
const {
  memberSearchTokens,
  memberSearchFilter,
  memberNameMatchesSearch,
} = require("../server/member_search");

function run() {
  assert.deepEqual(memberSearchTokens("Stephanie"), ["Stephanie"]);
  assert.deepEqual(memberSearchTokens("  Stephanie   Durugbor  "), [
    "Stephanie",
    "Durugbor",
  ]);
  assert.deepEqual(memberSearchTokens(""), []);

  assert.equal(memberNameMatchesSearch("DURUGBOR STEPHANIE", "Stephanie"), true);
  assert.equal(memberNameMatchesSearch("DURUGBOR STEPHANIE", "Durugbor"), true);
  assert.equal(
    memberNameMatchesSearch("DURUGBOR STEPHANIE", "Stephanie Durugbor"),
    true
  );
  assert.equal(
    memberNameMatchesSearch("DURUGBOR STEPHANIE", "  stephanie   durugbor "),
    true
  );
  assert.equal(
    memberNameMatchesSearch("DURUGBOR STEPHANIE", "DURUGBOR STEPHANIE"),
    true
  );
  assert.equal(memberNameMatchesSearch("DURUGBOR STEPHANIE", "Chioma"), false);
  assert.equal(
    memberNameMatchesSearch("DURUGBOR STEPHANIE", "Stephanie Okoro"),
    false
  );

  const one = memberSearchFilter("Stephanie");
  assert.equal(one.sql, "full_name ILIKE $1");
  assert.deepEqual(one.params, ["%Stephanie%"]);

  const full = memberSearchFilter("  Stephanie   Durugbor ");
  assert.equal(full.sql, "full_name ILIKE $1 AND full_name ILIKE $2");
  assert.deepEqual(full.params, ["%Stephanie%", "%Durugbor%"]);

  console.log("member search tests passed");
}

run();
