-- GVAC Alumni Dues: PostgreSQL schema
-- Amounts are stored as whole NGN. Financial writes must use the domain
-- service (or equivalent database transaction) so allocation invariants hold.

create extension if not exists pgcrypto;

create type gvac_period_status as enum ('active', 'excluded');
create type gvac_member_status as enum ('active', 'inactive');
create type gvac_allocation_kind as enum ('live_payment', 'historical_pdf');
create type gvac_gap_resolution as enum ('unresolved', 'paid', 'outstanding', 'forgiven', 'not_member');

create table graduation_sets (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  graduation_year integer,
  created_at timestamptz not null default now()
);

create table members (
  id uuid primary key default gen_random_uuid(),
  source_member_id text unique,
  full_name text not null,
  regular_dues_start_month date not null,
  writeoff_2023 boolean not null default false,
  membership_status gvac_member_status not null default 'active',
  graduation_set_id uuid references graduation_sets(id),
  date_added date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (regular_dues_start_month = date_trunc('month', regular_dues_start_month)::date)
);

-- Retains old source IDs after duplicate records are consolidated.
create table member_source_aliases (
  source_member_id text primary key,
  member_id uuid not null references members(id),
  source_name text not null,
  created_at timestamptz not null default now()
);

create table dues_periods (
  id uuid primary key default gen_random_uuid(),
  period_start date not null unique,
  normal_amount_ngn integer not null,
  period_status gvac_period_status not null,
  check (period_start = date_trunc('month', period_start)::date),
  check ((period_status = 'excluded' and normal_amount_ngn = 0)
      or (period_status = 'active' and normal_amount_ngn > 0))
);

-- The actual obligations. `amount_due_ngn` is 300 for eligible pre-2024
-- write-off dues, 500 for normal dues, and is never a partial payment.
create table member_dues (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id),
  dues_period_id uuid not null references dues_periods(id),
  original_amount_ngn integer not null,
  writeoff_amount_ngn integer not null default 0,
  amount_due_ngn integer not null,
  source_status text not null,
  source_page integer,
  created_at timestamptz not null default now(),
  unique (member_id, dues_period_id),
  check (original_amount_ngn >= amount_due_ngn),
  check (writeoff_amount_ngn = original_amount_ngn - amount_due_ngn),
  check (amount_due_ngn > 0)
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id),
  amount_ngn integer not null check (amount_ngn > 0),
  payment_date date not null,
  note_reference text,
  created_by uuid,
  created_at timestamptz not null default now()
);

-- Historical records have no payment_id and preserve their original star value
-- in source_payment_evidence_ngn. They allocate only the adjusted obligation
-- amount, so no fictional payment grouping or date is created.
create table dues_allocations (
  id uuid primary key default gen_random_uuid(),
  member_dues_id uuid not null references member_dues(id),
  payment_id uuid references payments(id),
  amount_allocated_ngn integer not null check (amount_allocated_ngn > 0),
  allocation_kind gvac_allocation_kind not null,
  source_payment_evidence_ngn integer,
  source_page integer,
  created_at timestamptz not null default now(),
  check ((allocation_kind = 'live_payment' and payment_id is not null and source_payment_evidence_ngn is null)
      or (allocation_kind = 'historical_pdf' and payment_id is null and source_payment_evidence_ngn = 500))
);

-- Explicit ledger gaps. They produce no obligation and are excluded from every
-- balance until an administrator resolves them.
create table unresolved_historical_periods (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id),
  period_start date not null,
  resolution gvac_gap_resolution not null default 'unresolved',
  resolution_note text,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (member_id, period_start),
  check (period_start = date_trunc('month', period_start)::date),
  check ((resolution = 'unresolved' and resolved_at is null and resolved_by is null)
      or resolution <> 'unresolved')
);

create index member_dues_member_id_idx on member_dues(member_id);
create index dues_allocations_member_dues_id_idx on dues_allocations(member_dues_id);
create unique index historical_pdf_allocation_once_per_due_idx
  on dues_allocations(member_dues_id)
  where allocation_kind = 'historical_pdf';
create index payments_member_id_idx on payments(member_id);
