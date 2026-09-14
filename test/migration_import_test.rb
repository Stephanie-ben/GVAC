# frozen_string_literal: true

require 'minitest/autorun'
require_relative '../lib/dues_calculator'
require_relative '../lib/migration_import'

class MigrationImportTest < Minitest::Test
  def plan
    @plan ||= Gvac::MigrationImport.new(File.expand_path('../data', __dir__)).plan
  end

  def test_reconciliation_matches_the_finalized_migration_model
    assert_equal({
      source_members: 106, canonical_members: 104, historical_paid_evidence: 3926,
      writeoff_members: 16, adjusted_obligations: 840, unresolved_periods: 156,
      current_outstanding_ngn: 284_100, future_scheduled_dues_ngn: 36_500,
      aliases: { 'M0068' => 'M0052', 'M0101' => 'M0069' }, unimportable_records: []
    }, plan.reconciliation)
  end

  def test_duplicate_ids_are_preserved_as_aliases_without_duplicate_obligations
    assert_equal 'M0052', plan.aliases['M0068']
    assert_equal 'M0069', plan.aliases['M0101']
    assert_equal plan.obligations.length, plan.obligations.map { |due| [due[:member_id], due[:period]] }.uniq.length
  end

  def test_writeoff_obligations_and_historical_allocations_are_full_adjusted_obligations
    adjusted = plan.obligations.select { |due| due[:amount_due_ngn] == 300 }
    assert_equal 840, adjusted.length
    allocation = plan.historical_allocations.find { |row| row[:amount_allocated_ngn] == 300 }
    refute_nil allocation
    assert_equal 500, allocation[:source_payment_evidence_ngn]
  end

  def test_unresolved_periods_are_not_obligations
    assert_equal 156, plan.unresolved_periods.length
    plan.unresolved_periods.each do |gap|
      refute plan.obligations.any? { |due| due[:member_id] == gap[:member_id] && due[:period] == gap[:period] }
    end
  end

  def test_running_the_read_only_plan_twice_has_the_same_unique_records
    second = Gvac::MigrationImport.new(File.expand_path('../data', __dir__)).plan
    assert_equal plan.reconciliation, second.reconciliation
    assert_equal plan.obligations, second.obligations
    assert_equal plan.historical_allocations, second.historical_allocations
  end
end
