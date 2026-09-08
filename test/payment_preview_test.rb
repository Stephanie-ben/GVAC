# frozen_string_literal: true

require 'json'
require 'minitest/autorun'
require 'open3'

class PaymentPreviewTest < Minitest::Test
  SCRIPT = File.expand_path('../lib/payment_preview.rb', __dir__)

  def test_amount_without_coverage_returns_oldest_first_span
    result = preview(
      amount_ngn: 1_000,
      as_of: '2024-03-01',
      obligations: four_normal_months
    )

    assert result['valid']
    assert_equal '2024-01-01', result['coverage']['start_period']
    assert_equal '2024-02-01', result['coverage']['end_period']
    assert_equal 1_000, result['coverage']['amount_ngn']
    assert_equal result['coverage'], result['proposed_coverage']
    assert_equal(
      [
        { 'period_start' => '2024-01-01', 'amount_allocated_ngn' => 500 },
        { 'period_start' => '2024-02-01', 'amount_allocated_ngn' => 500 }
      ],
      result['allocations']
    )
    assert_equal 500, result['outstanding_after_ngn']
  end

  def test_matching_coverage_is_valid
    result = preview(
      amount_ngn: 1_000,
      as_of: '2024-03-01',
      obligations: four_normal_months,
      coverage: { start_period: '2024-01-01', end_period: '2024-02-01' }
    )

    assert result['valid']
    assert_equal 1_000, result['coverage']['amount_ngn']
  end

  def test_wider_coverage_is_invalid_even_when_remaining_totals_match
    obligations = four_normal_months
    obligations[2]['amount_allocated_ngn'] = 500
    obligations[3]['amount_allocated_ngn'] = 500

    result = preview(
      amount_ngn: 1_000,
      as_of: '2024-04-01',
      obligations: obligations,
      coverage: { start_period: '2024-01-01', end_period: '2024-04-01' }
    )

    refute result['valid']
    assert_equal '2024-01-01', result['proposed_coverage']['start_period']
    assert_equal '2024-02-01', result['proposed_coverage']['end_period']
    assert_equal 1_000, result['proposed_coverage']['amount_ngn']
    assert_equal 1_000, result['coverage']['amount_ngn']
  end

  def test_adjusted_300_obligation_can_be_cleared
    result = preview(
      amount_ngn: 300,
      as_of: '2024-01-01',
      obligations: [
        obligation('2023-12-01', 300),
        obligation('2024-01-01', 500)
      ]
    )

    assert result['valid']
    assert_equal(
      [{ 'period_start' => '2023-12-01', 'amount_allocated_ngn' => 300 }],
      result['allocations']
    )
    assert_equal 500, result['outstanding_after_ngn']
  end

  def test_partial_month_against_a_normal_due_is_rejected
    status, output = preview_raw(
      amount_ngn: 300,
      obligations: [obligation('2024-01-01', 500)]
    )

    refute_equal 0, status
    assert_match(/partial payment/, output)
  end

  def test_settled_writeoff_is_skipped_so_april_2024_is_first
    result = preview(
      amount_ngn: 500,
      as_of: '2024-04-01',
      obligations: [
        obligation('2022-01-01', 300, allocated: 300),
        obligation('2024-04-01', 500)
      ]
    )

    assert result['valid']
    assert_equal '2024-04-01', result['coverage']['start_period']
    assert_equal '2024-04-01', result['coverage']['end_period']
    assert_equal(
      [{ 'period_start' => '2024-04-01', 'amount_allocated_ngn' => 500 }],
      result['allocations']
    )
  end

  def test_three_hundred_cannot_clear_april_2024_when_writeoff_is_settled
    status, _output = preview_raw(
      amount_ngn: 300,
      obligations: [
        obligation('2022-01-01', 300, allocated: 300),
        obligation('2024-04-01', 500)
      ]
    )

    refute_equal 0, status
  end

  private

  def four_normal_months
    (1..4).map { |month| obligation(format('2024-%02d-01', month), 500) }
  end

  def obligation(period_start, amount_due, allocated: 0)
    {
      'period_start' => period_start,
      'period_status' => 'active',
      'amount_due_ngn' => amount_due,
      'amount_allocated_ngn' => allocated
    }
  end

  def preview(payload)
    status, output = preview_raw(payload)
    assert_equal 0, status, output
    JSON.parse(output)
  end

  def preview_raw(payload)
    stdout, stderr, status = Open3.capture3('ruby', SCRIPT, stdin_data: JSON.generate(payload))
    [status.exitstatus, stdout.empty? ? stderr : stdout]
  end
end
