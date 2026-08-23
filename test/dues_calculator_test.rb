# frozen_string_literal: true

require 'minitest/autorun'
require_relative '../lib/dues_calculator'

class DuesCalculatorTest < Minitest::Test
  include Gvac

  def due(period, amount: 500, allocated: 0, excluded: false, unresolved: false)
    Obligation.new(period: Date.parse("#{period}-01"), amount_due_ngn: amount,
                   amount_allocated_ngn: allocated, excluded: excluded, unresolved: unresolved)
  end

  def test_normal_monthly_dues_are_500
    assert_equal 500, DuesCalculator.obligation_amount(writeoff_2023: false, period: '2023-12')
  end

  def test_mid_month_start_owes_full_month
    assert_equal 500, DuesCalculator.obligation_amount(writeoff_2023: false, period: Date.new(2024, 2, 17))
  end

  def test_2020_is_never_an_obligation_or_outstanding
    assert_equal 0, DuesCalculator.obligation_amount(writeoff_2023: true, period: '2020-06')
    assert_equal 0, DuesCalculator.outstanding(obligations: [due('2020-06', amount: 0, excluded: true)], as_of: '2026-08-01')
  end

  def test_unresolved_periods_do_not_become_debt
    assert_equal 0, DuesCalculator.outstanding(obligations: [due('2019-04', unresolved: true)], as_of: '2026-08-01')
  end

  def test_writeoff_adjusts_pre_2024_due_to_300
    assert_equal 300, DuesCalculator.obligation_amount(writeoff_2023: true, period: '2023-12')
  end

  def test_non_writeoff_pre_2024_due_remains_500
    assert_equal 500, DuesCalculator.obligation_amount(writeoff_2023: false, period: '2023-12')
  end

  def test_post_2023_due_is_500_for_writeoff_member
    assert_equal 500, DuesCalculator.obligation_amount(writeoff_2023: true, period: '2024-01')
  end

  def test_historical_payment_is_allocated_to_the_300_adjusted_obligation
    allocation = DuesCalculator.allocate_oldest_first(obligations: [due('2023-12', amount: 300)], payment_amount_ngn: 300)
    assert_equal [[due('2023-12', amount: 300), 300]], allocation
  end

  def test_500_clears_one_normal_oldest_obligation
    allocation = DuesCalculator.allocate_oldest_first(obligations: [due('2024-01'), due('2024-02')], payment_amount_ngn: 500)
    assert_equal [['2024-01', 500]], allocation.map { |item| [item[0].period.strftime('%Y-%m'), item[1]] }
  end

  def test_3000_clears_six_normal_months_oldest_first
    dues = (1..6).map { |month| due(format('2024-%02d', month)) }
    assert_equal 6, DuesCalculator.allocate_oldest_first(obligations: dues, payment_amount_ngn: 3000).length
  end

  def test_no_partial_payment_is_allowed
    assert_raises(ArgumentError) { DuesCalculator.allocate_oldest_first(obligations: [due('2024-01')], payment_amount_ngn: 300) }
  end

  def test_future_unpaid_dues_are_not_current_outstanding
    assert_equal 0, DuesCalculator.outstanding(obligations: [due('2027-01')], as_of: '2026-08-01')
  end

  def test_future_prepayment_extends_paid_up_to_when_continuous
    dues = [due('2024-01', allocated: 500), due('2024-02', allocated: 500), due('2024-03', allocated: 500)]
    assert_equal Date.new(2024, 3, 1), DuesCalculator.paid_up_to(obligations: dues, regular_dues_start_month: '2024-01', as_of: '2024-01')
  end

  def test_m0003_paid_up_to_includes_paid_pre_start_writeoff_obligations
    early_writeoffs = m0003_pre_start_writeoffs
    dues = early_writeoffs + [due('2021-03', amount: 300, allocated: 300)]

    assert_equal Date.new(2021, 3, 1), DuesCalculator.paid_up_to(
      obligations: dues, regular_dues_start_month: '2021-03', as_of: '2021-03-01'
    )
  end

  def test_m0003_paid_up_to_does_not_skip_an_unpaid_pre_start_writeoff_obligation
    early_writeoffs = m0003_pre_start_writeoffs
    early_writeoffs.first.amount_allocated_ngn = 0 # 2018-01 remains unpaid.
    dues = early_writeoffs + [due('2021-03', amount: 300, allocated: 300)]

    assert_nil DuesCalculator.paid_up_to(
      obligations: dues, regular_dues_start_month: '2021-03', as_of: '2021-03-01'
    )
  end

  def test_paid_up_to_stops_at_first_uncleared_month
    dues = [due('2024-01', allocated: 500), due('2024-02'), due('2024-03', allocated: 500)]
    assert_equal Date.new(2024, 1, 1), DuesCalculator.paid_up_to(obligations: dues, regular_dues_start_month: '2024-01', as_of: '2026-08-01')
  end

  def test_paid_up_to_stops_at_an_unresolved_gap
    dues = [due('2024-01', allocated: 500), due('2024-02', unresolved: true), due('2024-03', allocated: 500)]
    assert_equal Date.new(2024, 1, 1), DuesCalculator.paid_up_to(obligations: dues, regular_dues_start_month: '2024-01', as_of: '2026-08-01')
  end

  def test_remaining_and_outstanding_never_go_negative
    assert_equal 0, DuesCalculator.remaining(due('2024-01', allocated: 600))
    assert_equal 0, DuesCalculator.outstanding(obligations: [due('2024-01', allocated: 600)], as_of: '2026-08-01')
  end

  private

  # M0003 has 26 valid write-off obligations before its regular 2021-03 start:
  # Jan-Dec 2018, Jan-Dec 2019, and Jan-Feb 2021. 2020 is excluded.
  def m0003_pre_start_writeoffs
    months = []
    current = Date.new(2018, 1, 1)
    last = Date.new(2021, 2, 1)
    while current <= last
      months << current unless current.year == 2020
      current = DuesCalculator.next_month(current)
    end
    months.map do |period|
      Obligation.new(period: period, amount_due_ngn: 300, amount_allocated_ngn: 300,
                     excluded: false, unresolved: false)
    end
  end
end
