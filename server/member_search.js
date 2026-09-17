function memberSearchTokens(search) {
  return String(search || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function memberSearchFilter(search) {
  const tokens = memberSearchTokens(search);

  if (tokens.length === 0) {
    return {
      sql: "full_name ILIKE $1",
      params: ["%"],
    };
  }

  return {
    sql: tokens.map((_, index) => `full_name ILIKE $${index + 1}`).join(" AND "),
    params: tokens.map((token) => `%${token}%`),
  };
}

function memberNameMatchesSearch(fullName, search) {
  const tokens = memberSearchTokens(search);
  if (tokens.length === 0) return true;

  const haystack = String(fullName || "").toUpperCase();
  return tokens.every((token) => haystack.includes(token.toUpperCase()));
}

module.exports = {
  memberSearchTokens,
  memberSearchFilter,
  memberNameMatchesSearch,
};
