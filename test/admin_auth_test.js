const assert = require("node:assert/strict");
const {
  authenticateAdmin,
  adminAuthConfigured,
  isAllowedFrontendOrigin,
  requireAdmin,
  sessionConfig,
  ADMIN_IDLE_TIMEOUT_MS,
  touchAdminSession,
} = require("../server/admin_auth");

const env = {
  SESSION_SECRET: "test-session-secret-value",
  ADMIN_FINANCIAL_SECRETARY_USERNAME: "finance.admin",
  ADMIN_FINANCIAL_SECRETARY_PASSWORD: "finance-pass",
  ADMIN_TREASURER_USERNAME: "treasurer.admin",
  ADMIN_TREASURER_PASSWORD: "treasurer-pass",
  FRONTEND_ORIGIN: "https://gvac.example",
};

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function run() {
  assert.deepEqual(
    authenticateAdmin("finance.admin", "finance-pass", env),
    { role: "Financial Secretary" }
  );
  assert.deepEqual(
    authenticateAdmin("  treasurer.admin  ", "treasurer-pass", env),
    { role: "Treasurer" }
  );
  assert.equal(authenticateAdmin("finance.admin", "wrong", env), null);
  assert.equal(authenticateAdmin("unknown", "finance-pass", env), null);
  assert.equal(authenticateAdmin("", "finance-pass", env), null);

  assert.equal(adminAuthConfigured(env), true);
  assert.equal(adminAuthConfigured({ ...env, SESSION_SECRET: "" }), false);
  assert.equal(
    adminAuthConfigured({
      SESSION_SECRET: "secret",
      ADMIN_FINANCIAL_SECRETARY_USERNAME: "",
      ADMIN_TREASURER_USERNAME: "",
    }),
    false
  );

  assert.equal(isAllowedFrontendOrigin("https://gvac.example", env), true);
  assert.equal(isAllowedFrontendOrigin("http://localhost:5173", env), true);
  assert.equal(isAllowedFrontendOrigin("http://127.0.0.1:5173", env), true);
  assert.equal(isAllowedFrontendOrigin("http://192.168.101.25:5173", env), true);
  assert.equal(isAllowedFrontendOrigin("http://172.20.10.2:5173", env), true);
  assert.equal(isAllowedFrontendOrigin("https://evil.example", env), false);

  const unauthorized = mockRes();
  let nextCalled = false;
  requireAdmin({ session: {} }, unauthorized, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, false);
  assert.equal(unauthorized.statusCode, 401);
  assert.equal(unauthorized.body.error, "Admin login required.");

  const authorized = mockRes();
  nextCalled = false;
  requireAdmin(
    { session: { admin: { role: "Treasurer" } } },
    authorized,
    () => {
      nextCalled = true;
    }
  );
  assert.equal(nextCalled, true);
  assert.equal(authorized.statusCode, 200);

  assert.equal(ADMIN_IDLE_TIMEOUT_MS, 30 * 60 * 1000);
  const config = sessionConfig(env);
  assert.equal(config.rolling, true);
  assert.equal(config.cookie.maxAge, ADMIN_IDLE_TIMEOUT_MS);

  let touched = false;
  const touchReq = {
    session: {
      admin: { role: "Treasurer" },
      touch() {
        touched = true;
      },
    },
  };
  touchAdminSession(touchReq, {}, () => {});
  assert.equal(touched, true);

  console.log("admin authentication tests passed");
}

run();
