const crypto = require("crypto");

const SESSION_COOKIE_NAME = "gvac_admin_session";
const FINANCIAL_SECRETARY = "Financial Secretary";
const TREASURER = "Treasurer";
const ADMIN_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

function trimToString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));

  if (leftBuffer.length !== rightBuffer.length) {
    crypto.timingSafeEqual(leftBuffer, leftBuffer);
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function adminAccountsFromEnv(env = process.env) {
  return [
    {
      role: FINANCIAL_SECRETARY,
      username: trimToString(env.ADMIN_FINANCIAL_SECRETARY_USERNAME),
      password: env.ADMIN_FINANCIAL_SECRETARY_PASSWORD || "",
    },
    {
      role: TREASURER,
      username: trimToString(env.ADMIN_TREASURER_USERNAME),
      password: env.ADMIN_TREASURER_PASSWORD || "",
    },
  ].filter((account) => account.username && account.password);
}

function authenticateAdmin(username, password, env = process.env) {
  const providedUsername = trimToString(username);
  const providedPassword = typeof password === "string" ? password : "";
  if (!providedUsername || !providedPassword) return null;

  let matched = null;
  for (const account of adminAccountsFromEnv(env)) {
    const usernameMatches = safeEqual(account.username, providedUsername);
    const passwordMatches = safeEqual(account.password, providedPassword);
    if (usernameMatches && passwordMatches) {
      matched = { role: account.role };
    }
  }

  return matched;
}

function adminAuthConfigured(env = process.env) {
  return Boolean(trimToString(env.SESSION_SECRET) && adminAccountsFromEnv(env).length > 0);
}

function isAllowedFrontendOrigin(origin, env = process.env) {
  if (!origin) return true;

  const configured = trimToString(env.FRONTEND_ORIGIN);
  if (configured && origin === configured) return true;

  let parsed;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(parsed.hostname)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(parsed.hostname)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(parsed.hostname)) return true;

  return false;
}

function sessionCookieOptions(env = process.env) {
  const secure =
    env.COOKIE_SECURE === "true" || env.NODE_ENV === "production";

  return {
    httpOnly: true,
    sameSite: secure ? "none" : "lax",
    secure,
  };
}

function sessionConfig(env = process.env) {
  return {
    name: SESSION_COOKIE_NAME,
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      ...sessionCookieOptions(env),
      maxAge: ADMIN_IDLE_TIMEOUT_MS,
    },
  };
}

function touchAdminSession(req, res, next) {
  if (req.session && req.session.admin && req.session.admin.role && typeof req.session.touch === "function") {
    req.session.touch();
  }

  return next();
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.admin && req.session.admin.role) {
    if (typeof req.session.touch === "function") {
      req.session.touch();
    }
    return next();
  }

  return res.status(401).json({ error: "Admin login required." });
}

module.exports = {
  SESSION_COOKIE_NAME,
  FINANCIAL_SECRETARY,
  TREASURER,
  ADMIN_IDLE_TIMEOUT_MS,
  adminAccountsFromEnv,
  adminAuthConfigured,
  authenticateAdmin,
  isAllowedFrontendOrigin,
  requireAdmin,
  sessionConfig,
  sessionCookieOptions,
  touchAdminSession,
};
