# GVAC Alumni Dues Management System — Product Specification

## 1. Product purpose

Build a dues-management web application for the GVAC Lagos Zone Alumni body. Replace the current spreadsheet/PDF workflow with a maintainable application that maintains members, calculates monthly dues, records payments, allocates bulk payments automatically, and shows transparent balances.

## 2. Users

### Admin
Admins can add and edit members, set/change dues start month, optionally manage graduation sets, record/correct payments, and view dashboards and all member records.

### Member
Members can search for a name and view the member's dues record. Dues are intentionally transparent within the alumni body. Only admins can change records.

## 3. Dues rules

- Monthly dues: NGN 500.
- Historical timeline starts in 2018.
- 2020 dues were suspended due to COVID-19 and must not generate obligations or outstanding balances. Communicate this in the UI.
- Every member has a `dues_start_month`.
- A member starting mid-month owes the full NGN 500 for that month.
- Existing members' historical start months are inferred/assigned from the source ledger.
- New members start accruing from the month they are added.
- Historical monthly states: `paid`, `outstanding`, `not_member`.
- Green cells in the PDF mean `not_member`, not unpaid.
- PDF `*` means paid.
- No partial-payment behaviour in MVP; monthly dues are cleared in NGN 500 increments.
- Members can pay multiple months at once.
- Bulk payments allocate to the oldest outstanding applicable months first.
- Future prepayments are valid. The source PDF contains records through 2028 and these should not be rejected merely because they are future-dated.

## 4. Paid up to

`Paid up to` is the latest consecutive applicable month through which dues are cleared, starting from the member's dues start month. It must stop at the first uncleared applicable month.

## 5. Colour system

- Green = paid
- Red = outstanding
- Neutral/grey = not a member / not applicable
- 2020 = excluded-year treatment, not an outstanding status

Do not use stars or ticks as the primary status indicator.

## 6. Data model

### members
- id
- full_name
- dues_start_month
- graduation_set_id (nullable)
- status
- date_added
- created_at
- updated_at

### graduation_sets
- id
- name
- graduation_year (nullable)

Graduation set is optional metadata and can be populated gradually.

### dues_periods
One record per calendar month:
- id
- year
- month
- period_start
- amount
- status

Normal periods have amount 500 and status active. 2020 periods are excluded.

### member_dues
One monthly obligation per applicable member/period:
- id
- member_id
- dues_period_id
- amount_due
- amount_paid
- status

### payments
Actual payments recorded in the live system:
- id
- member_id
- amount
- payment_date
- note/reference (nullable)
- created_by
- created_at

### payment_allocations
Connect payments to monthly obligations:
- id
- payment_id
- member_dues_id
- amount_allocated

Do not fabricate historical payment dates or transaction groupings because the PDF does not contain them. Historical paid months should be imported as historical allocations/statuses.

## 7. Calculations

- Total applicable dues = sum of applicable monthly obligations.
- Total paid = sum of payment allocations.
- Outstanding = total applicable dues - total paid.
- Excluded 2020 periods never enter these calculations.
- Outstanding cannot be negative.
- A monthly obligation cannot be allocated more than its amount due.
- Valid future prepayments must be preserved and represented correctly.

## 8. Admin MVP

### Dashboard
Show total members, total outstanding, paid-up count, owing count, members with no recorded payments, and outstanding by graduation set where available.

### Members
Show name, graduation set if available, dues start, paid up to, outstanding, and status. Filters: all, paid up, owing, no payment, graduation set.

### Member detail
Show name, graduation set, dues start, total dues, total paid, outstanding, paid up to, monthly colour-coded history, and payment history.

### Add member
Required: full name, date/month added. Default dues start is the month added unless admin explicitly sets another month. Graduation set optional.

### Record payment
Required: member, amount, payment date. Optional: note/reference. Before saving, show proposed oldest-outstanding-first allocation. After saving, recalculate balances and paid up to.

## 9. Member MVP

Provide simple name search. A member can view the selected record including total dues, total paid, outstanding, paid up to, monthly colour-coded history, and the explanation for 2020 exclusion. Do not require member accounts/login for the first MVP unless technically necessary. Admin write access must be protected.

## 10. UX principles

Prioritise immediate understanding of what is owed, strong visual scanability, minimal admin effort, transparent records, and a clear distinction between paid, outstanding, and not-yet-a-member. Do not recreate the PDF's dense spreadsheet experience as the primary interface.

## 11. Technical direction

Preferred stack unless a strong technical reason suggests otherwise: Next.js, TypeScript, PostgreSQL/Supabase, responsive web application. Use a relational database, not one large JSON/spreadsheet blob. Keep financial rules in a testable domain/service layer.

## 12. Required tests

At minimum test:
1. Monthly dues = NGN 500.
2. Mid-month start owes full NGN 500 for that month.
3. 2020 never contributes to outstanding.
4. Not-member months do not become debt.
5. Applicable unpaid month becomes outstanding.
6. NGN 500 clears one oldest outstanding month.
7. NGN 3,000 clears six NGN 500 months.
8. Bulk payments allocate oldest outstanding first.
9. Future prepayments can clear future periods.
10. Paid up to stops at the first uncleared applicable month.
11. Allocation cannot exceed a monthly obligation.
12. Outstanding cannot become negative.
13. New member added in a month starts liability in that month.
14. Historical migration does not invent payment dates.

## 13. Build order

1. Inspect and validate migration CSVs.
2. Report ambiguities.
3. Create database schema.
4. Import historical data.
5. Implement dues calculations.
6. Implement payment allocation.
7. Write/pass financial tests.
8. Build admin member management.
9. Build admin payment recording.
10. Build dashboard.
11. Build member search/view.
12. Add visual polish and responsive behaviour.

Do not build the whole application in one pass. At each stage, run relevant tests before moving on.

## 14. Constraints

Do not invent graduation sets, historical payment dates, or missing business rules. Do not treat green cells as unpaid. Do not include 2020 in debt. Do not reject future-dated valid payments. Do not add partial-payment behaviour. Do not silently change migration data.
