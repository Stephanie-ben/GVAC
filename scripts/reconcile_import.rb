#!/usr/bin/env ruby
# frozen_string_literal: true

require_relative '../lib/dues_calculator'
require_relative '../lib/migration_import'

plan = Gvac::MigrationImport.new(File.expand_path('../data', __dir__)).plan
report = plan.reconciliation
puts 'Read-only import reconciliation passed.'
report.each { |key, value| puts "#{key}: #{value}" }
