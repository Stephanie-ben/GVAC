# frozen_string_literal: true

# A read-only representation of the PostgreSQL migration. It validates and
# reconciles the supplied CSVs without changing anything under data/.
require 'csv'
require 'date'
require_relative 'dues_calculator'

module Gvac
  class MigrationImport
    ALIASES = { 'M0068' => 'M0052', 'M0101' => 'M0069' }.freeze
    AS_OF = Date.new(2026, 8, 1)

    attr_reader :members, :obligations, :historical_allocations, :unresolved_periods, :aliases

    def initialize(data_directory)
      @data_directory = data_directory
      @aliases = ALIASES
    end

    def plan
      source_members = csv('members.csv')
      history = csv('dues_history.csv')
      payment_rows = csv('historical_payment_allocations.csv')
      validate_sources!(source_members, history, payment_rows)

      @members = canonical_members(source_members, history)
      @obligations = build_obligations(history)
      @historical_allocations = build_allocations(payment_rows)
      @unresolved_periods = build_unresolved_periods(history)
      validate_plan!
      self
    end

    def reconciliation
      paid_evidence = historical_allocations.length
      current = obligations.sum do |due|
        due[:period] <= AS_OF && !due[:paid] ? due[:amount_due_ngn] : 0
      end
      scheduled = obligations.sum do |due|
        due[:period] > AS_OF && !due[:paid] ? due[:amount_due_ngn] : 0
      end
      {
        source_members: csv('members.csv').length,
        canonical_members: members.length,
        historical_paid_evidence: paid_evidence,
        writeoff_members: members.count { |member| member[:writeoff_2023] },
        adjusted_obligations: obligations.count { |due| due[:amount_due_ngn] == 300 },
        unresolved_periods: unresolved_periods.length,
        current_outstanding_ngn: current,
        future_scheduled_dues_ngn: scheduled,
        aliases: aliases,
        unimportable_records: []
      }
    end

    private

    def csv(filename)
      CSV.table(File.join(@data_directory, filename)).map(&:to_h).map do |row|
        row.transform_keys(&:to_s).transform_values { |value| value.nil? ? '' : value.to_s }
      end
    end

    def canonical_id(source_id)
      aliases.fetch(source_id, source_id)
    end

    def canonical_members(source_members, history)
      writeoff_ids = history.select { |row| row['status'] == 'not_member' }.map { |row| canonical_id(row['member_id']) }.uniq
      source_members.group_by { |row| canonical_id(row['member_id']) }.map do |id, rows|
        canonical_row = rows.find { |row| row['member_id'] == id } || rows.first
        {
          source_member_id: id,
          full_name: canonical_row['name'],
          regular_dues_start_month: rows.map { |row| Date.parse("#{row['dues_start_month']}-01") }.min,
          writeoff_2023: writeoff_ids.include?(id)
        }
      end.sort_by { |member| member[:source_member_id] }
    end

    def build_obligations(history)
      rows = history.reject { |row| row['status'] == 'excluded' }.map do |row|
        member = members.find { |candidate| candidate[:source_member_id] == canonical_id(row['member_id']) }
        period = Date.parse("#{row['period']}-01")
        adjusted = member[:writeoff_2023] && period <= Date.new(2023, 12, 1)
        {
          member_id: member[:source_member_id], period: period, source_status: row['status'],
          source_page: row['source_page'], original_amount_ngn: 500,
          writeoff_amount_ngn: adjusted ? 200 : 0,
          amount_due_ngn: adjusted ? 300 : 500,
          paid: row['status'] == 'paid'
        }
      end
      duplicate = rows.group_by { |row| [row[:member_id], row[:period]] }.find { |_key, matches| matches.length > 1 }
      raise "duplicate applicable canonical period #{duplicate[0].inspect}" if duplicate

      rows
    end

    def build_allocations(payment_rows)
      due_index = obligations.to_h { |due| [[due[:member_id], due[:period]], due] }
      payment_rows.map do |row|
        key = [canonical_id(row['member_id']), Date.parse("#{row['period']}-01")]
        due = due_index.fetch(key)
        {
          member_id: key[0], period: key[1], amount_allocated_ngn: due[:amount_due_ngn],
          source_payment_evidence_ngn: 500, source_page: row['source_page']
        }
      end
    end

    def build_unresolved_periods(history)
      known = history.group_by { |row| [canonical_id(row['member_id']), row['period']] }
      members.flat_map do |member|
        periods = history.select { |row| canonical_id(row['member_id']) == member[:source_member_id] }.map { |row| row['period'] }
        last = Date.parse("#{periods.max}-01")
        month = member[:regular_dues_start_month]
        missing = []
        while month <= last
          key = [member[:source_member_id], month.strftime('%Y-%m')]
          missing << { member_id: member[:source_member_id], period: month } if month.year != 2020 && !known.key?(key)
          month = DuesCalculator.next_month(month)
        end
        missing
      end
    end

    def validate_sources!(source_members, history, payment_rows)
      raise 'source member IDs are not unique' unless source_members.map { |row| row['member_id'] }.uniq.length == source_members.length
      names = source_members.to_h { |row| [row['member_id'], row['name']] }
      raise 'history has an invalid member' unless history.all? { |row| names[row['member_id']] == row['member_name'] }
      raise 'allocation has an invalid member' unless payment_rows.all? { |row| names[row['member_id']] == row['member_name'] }
      paid = history.select { |row| row['status'] == 'paid' }.map { |row| [row['member_id'], row['period']] }.sort
      allocated = payment_rows.map { |row| [row['member_id'], row['period']] }.sort
      raise 'paid source rows and payment evidence differ' unless paid == allocated
      raise 'non-2020 excluded source row' if history.any? { |row| !row['period'].start_with?('2020-') && row['status'] == 'excluded' }
    end

    def validate_plan!
      raise 'historical allocation duplicated' unless historical_allocations.map { |row| [row[:member_id], row[:period]] }.uniq.length == historical_allocations.length
      raise 'partial historical allocation planned' unless historical_allocations.all? do |allocation|
        due = obligations.find { |candidate| candidate[:member_id] == allocation[:member_id] && candidate[:period] == allocation[:period] }
        allocation[:amount_allocated_ngn] == due[:amount_due_ngn]
      end
      raise 'unresolved period was imported as a debt' if unresolved_periods.any? do |gap|
        obligations.any? { |due| due[:member_id] == gap[:member_id] && due[:period] == gap[:period] }
      end
    end
  end
end
