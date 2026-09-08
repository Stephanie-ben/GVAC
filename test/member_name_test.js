const assert = require("node:assert/strict");

async function run() {
  const { namesMatch } = await import("../frontend/src/admin/memberName.js");

  assert.equal(namesMatch("NDUKWE JANET", "Janet", "Ndukwe"), true);
  assert.equal(namesMatch("NDUKWE JANET", "Ndukwe", "Janet"), true);
  assert.equal(namesMatch("IHEZUE OGOCHUKWU", "Ogochukwu", "Ihezue"), true);
  assert.equal(namesMatch("ACHUGONYE CHIOMA", "Chioma", "Achugonye"), true);
  assert.equal(namesMatch("NDUKWE JANET", "Chioma", "Achugonye"), false);
  assert.equal(namesMatch("NDUKWE JANET", "Janet", "Okoro"), false);
  assert.equal(namesMatch("", "Janet", "Ndukwe"), false);

  console.log("member name duplicate matching tests passed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
