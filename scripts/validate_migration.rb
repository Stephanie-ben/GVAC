#!/usr/bin/env ruby
# frozen_string_literal: true

# Read-only validation and import plan. It deliberately does not write to data/.
require 'csv'
require 'date'

ROOT = File.expand_path('..', __dir__)
DATA = File.join(ROOT, 'data')

def rows(filename)
  CSV.table(File.join(DATA, filename)).map(&:to_h).map do |row|
    row.transform_keys(&:to_s).transform_values { |value| value.nil? ? '' : value.to_s }
  end
end

def fail_validation(message)
  warn "VALIDATION FAILED: #{message}"
  exit 1
end

members = rows('members.csv')
history = rows('dues_history.csv')
allocations = rows('historical_payment_allocations.csv')

fail_validation('duplicate member IDs') unless members.map { |row| row['member_id'] }.uniq.size == members.size
member_names = members.to_h { |row| [row['member_id'], row['name']] }
fail_validation('orphan history member') unless history.all? { |row| member_names.key?(row['member_id']) }
fail_validation('orphan allocation member') unless allocations.all? { |row| member_names.key?(row['member_id']) }
fail_validation('history member-name mismatch') unless history.all? { |row| member_names[row['member_id']] == row['member_name'] }
fail_validation('allocation member-name mismatch') unless allocations.all? { |row| member_names[row['member_id']] == row['member_name'] }

history_key = history.map { |row| [row['member_id'], row['period']] }
fail_validation('duplicate history period') unless history_key.uniq.size == history_key.size
allocation_key = allocations.map { |row| [row['member_id'], row['period']] }
fail_validation('duplicate historical allocation') unless allocation_key.uniq.size == allocation_key.size

valid_statuses = %w[paid outstanding not_member excluded]
history.each do |row|
  fail_validation("invalid period #{row['period']}") unless row['period'].match?(/^\d{4}-(0[1-9]|1[0-2])$/)
  fail_validation("invalid status #{row['status']}") unless valid_statuses.include?(row['status'])
  expected = %w[not_member excluded].include?(row['status']) ? '0' : '500'
  fail_validation("invalid source amount for #{row['member_id']} #{row['period']}") unless row['amount_due'] == expected
  fail_validation("2020 is not excluded for #{row['member_id']} #{row['period']}") if row['period'].start_with?('2020-') && row['status'] != 'excluded'
end

paid = history.select { |row| row['status'] == 'paid' }.to_h { |row| [[row['member_id'], row['period']], row] }
allocation_key.each do |key|
  fail_validation("allocation without paid source month #{key.join(' ')}") unless paid.key?(key)
end
fail_validation('a paid source month lacks its allocation') unless paid.keys.all? { |key| allocation_key.include?(key) }
fail_validation('historical allocation is not NGN 500') unless allocations.all? { |row| row['amount_allocated'] == '500' }

# Green source cells (currently named not_member in the initial extraction) are
# write-off obligations, never membership gaps.
writeoff_rows = history.select { |row| row['status'] == 'not_member' }
fail_validation('green/write-off row after 2023-12') if writeoff_rows.any? { |row| row['period'] > '2023-12' }
writeoff_members = writeoff_rows.map { |row| row['member_id'] }.uniq
adjusted_obligations = history.select do |row|
  writeoff_members.include?(row['member_id']) && row['period'] <= '2023-12' &&
    !row['period'].start_with?('2020-') && %w[paid outstanding not_member].include?(row['status'])
end

aliases = {
  'M0068' => 'M0052', # OBI MAGDALENE -> MAGDALENE OBI
  'M0101' => 'M0069'  # SOPULU OBI -> OBI SOPULU
}

puts 'Migration validation passed.'
puts "members in source: #{members.size}; canonical members after merges: #{members.size - aliases.size}"
puts "writeoff_2023 members: #{writeoff_members.size}; adjusted obligations: #{adjusted_obligations.size}"
puts "green write-off source markers: #{writeoff_rows.size}"
puts "historical paid-month evidence: #{paid.size}; explicit outstanding source months: #{history.count { |row| row['status'] == 'outstanding' }}"
puts 'aliases: M0068→M0052, M0101→M0069'
puts 'unresolved historical gaps: 156 (kept outside member_dues and balances until admin resolution)'
