# frozen_string_literal: true

require 'json'
require_relative 'dues_calculator'

payload = JSON.parse($stdin.read)
calculator = Gvac::DuesCalculator
obligations = payload.fetch('obligations').map do |row|
  period = calculator.month(row.fetch('period_start'))
  Gvac::Obligation.new(
    period: period,
    amount_due_ngn: Integer(row.fetch('amount_due_ngn')),
    amount_allocated_ngn: Integer(row.fetch('amount_allocated_ngn')),
    excluded: row['period_status'] == 'excluded' || period.year == Gvac::EXCLUDED_YEAR,
    unresolved: row.fetch('unresolved', false)
  )
end
amount = Integer(payload.fetch('amount_ngn'))
raise ArgumentError, 'payment amount must be positive' unless amount.positive?

allocations = calculator.allocate_oldest_first(
  obligations: obligations,
  payment_amount_ngn: amount
)
proposed = calculator.allocation_coverage(allocations)
as_of = payload.key?('as_of') ? payload.fetch('as_of') : Date.today

updated_obligations = obligations.map do |due|
  added = allocations.sum { |allocated_due, allocated| allocated_due.equal?(due) ? allocated : 0 }
  Gvac::Obligation.new(
    period: due.period,
    amount_due_ngn: due.amount_due_ngn,
    amount_allocated_ngn: due.amount_allocated_ngn + added,
    excluded: due.excluded,
    unresolved: due.unresolved
  )
end
outstanding_after = calculator.outstanding(obligations: updated_obligations, as_of: as_of)

allocation_payload = allocations.map do |due, allocated|
  { period_start: due.period.to_s, amount_allocated_ngn: allocated }
end

coverage = payload['coverage']
if coverage
  start_period = calculator.month(coverage.fetch('start_period'))
  end_period = calculator.month(coverage.fetch('end_period'))
  selected_amount = calculator.coverage_amount(
    obligations: obligations,
    start_period: start_period,
    end_period: end_period
  )
  valid = calculator.coverage_matches_allocation?(
    allocations: allocations,
    start_period: start_period,
    end_period: end_period
  )
else
  start_period = proposed[:start_period]
  end_period = proposed[:end_period]
  selected_amount = proposed[:amount_ngn]
  valid = true
end

puts JSON.generate(
  valid: valid,
  amount_ngn: amount,
  coverage: {
    start_period: start_period.to_s,
    end_period: end_period.to_s,
    amount_ngn: selected_amount
  },
  proposed_coverage: {
    start_period: proposed[:start_period].to_s,
    end_period: proposed[:end_period].to_s,
    amount_ngn: proposed[:amount_ngn]
  },
  allocations: allocation_payload,
  outstanding_after_ngn: outstanding_after
)
