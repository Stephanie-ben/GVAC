# frozen_string_literal: true

require 'json'
require_relative 'dues_calculator'

payload = JSON.parse($stdin.read)
obligations = payload.fetch('obligations').map do |row|
  period = Gvac::DuesCalculator.month(row.fetch('period_start'))
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

allocations = Gvac::DuesCalculator.allocate_oldest_first(
  obligations: obligations,
  payment_amount_ngn: amount
)

coverage = payload['coverage']
if coverage
  start_period = Gvac::DuesCalculator.month(coverage.fetch('start_period'))
  end_period = Gvac::DuesCalculator.month(coverage.fetch('end_period'))
  coverage_amount = Gvac::DuesCalculator.coverage_amount(
    obligations: obligations,
    start_period: start_period,
    end_period: end_period
  )

  puts JSON.generate(valid: coverage_amount == amount, amount_ngn: amount,
                     coverage: { start_period: start_period.to_s, end_period: end_period.to_s, amount_ngn: coverage_amount })
else
  periods = allocations.map { |due, _allocated| due.period }
  puts JSON.generate(valid: true, amount_ngn: amount,
                     coverage: { start_period: periods.first.to_s, end_period: periods.last.to_s, amount_ngn: amount })
end
