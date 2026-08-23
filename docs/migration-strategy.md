# Finalized migration strategy

This process is intentionally read-only with respect to `data/`. Run
`ruby scripts/validate_migration.rb` before any database import.

1. Load each CSV into a staging table with its raw row, filename, source page,
   and checksum. The source CSVs remain unchanged.
2. Consolidate the confirmed duplicate identities into canonical members
   `M0052` and `M0069`. Store `M0068` and `M0101` in `member_source_aliases`.
3. Seed `dues_periods` from 2018-01 through 2028-12. Set all 2020 periods to
   `excluded` and NGN 0; all other periods are active at NGN 500.
4. Import members. Set `writeoff_2023` true for the 16 members identified by a
   green source cell. Preserve `regular_dues_start_month` exactly as supplied;
   it is not retroactively changed for valid earlier write-off obligations.
5. Import explicit history rows:
   - Every applicable pre-2024 row for a `writeoff_2023` member—whether
     `paid`, `outstanding`, or green/initially-extracted `not_member`—creates
     an obligation with original NGN 500, write-off NGN 200, and adjusted due
     NGN 300. A green row is not a payment and not a not-member period.
   - A non-write-off `paid` row creates a normal applicable obligation and a
     historical allocation; a non-write-off `outstanding` row creates a normal
     obligation without an allocation.
   - All applicable January 2024 onward rows create normal NGN 500 obligations.
   - `excluded`: create no obligation.
6. For a paid star on an adjusted obligation, retain NGN 500 as source payment
   evidence but allocate NGN 300—the adjusted obligation amount. This does not
   invent a payment date, transaction grouping, or partial payment.
7. Insert the 180 absent applicable periods into
   `unresolved_historical_periods` with `resolution = unresolved`. Do not
   create obligations or include them in balances or Paid up to.
8. Reconcile the imported counts, allocations, aliases, and pre-2024 write-off
   adjustments inside one database transaction. Roll back on any mismatch.

Future paid rows are imported as normal NGN 500 cleared obligations. Future
unpaid rows are normal NGN 500 obligations but are excluded from current
outstanding until their period arrives. They remain visible as scheduled dues.
