export function normalizeMemberName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').toUpperCase()
}

export function namesMatch(existingName, firstName, lastName) {
  const existing = normalizeMemberName(existingName)
  const first = String(firstName || '').trim()
  const last = String(lastName || '').trim()
  if (!existing || !first || !last) return false

  return (
    existing === normalizeMemberName(`${first} ${last}`) ||
    existing === normalizeMemberName(`${last} ${first}`)
  )
}
