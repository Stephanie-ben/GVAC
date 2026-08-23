# GVAC Alumni Dues — Codex Instructions

Read `docs/product-spec.md` before making product or architecture decisions.

Historical migration data lives in `data/`. Do not silently alter migration source files. If data is ambiguous, document it or ask before changing it.

## Working principles
- Build the smallest useful MVP first.
- Treat financial calculations and payment allocation as high-priority logic.
- Write automated tests for financial rules.
- Keep business rules in a testable domain/service layer rather than burying them in UI components.
- Do not invent missing business rules.
- Green historical cells mean the person was not yet a member; they are NOT debt.
- Never include 2020 in dues calculations.
- Support valid future prepayments.
- Preserve historical data without fabricating payment dates.

## Build sequence
1. Validate migration data.
2. Propose/implement database schema.
3. Import historical data.
4. Implement and test dues calculations.
5. Implement and test payment allocation.
6. Build admin workflows.
7. Build member-facing search/view.
8. Polish UI.

## UI
- Green = paid
- Red = outstanding
- Neutral/grey = not a member/not applicable
- 2020 = excluded-year treatment
- "Paid up to" must be prominent wherever member balances are shown.

When uncertain about a business rule, ask rather than guess.
