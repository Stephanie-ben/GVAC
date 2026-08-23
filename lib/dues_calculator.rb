# frozen_string_literal: true

require 'date'

module Gvac
  DUES_AMOUNT_NGN = 500
  WRITEOFF_AMOUNT_NGN = 200
  WRITEOFF_PAYABLE_NGN = 300
  EXCLUDED_YEAR = 2020
  WRITEOFF_LAST_MONTH = Date.new(2023, 12, 1)

  Obligation = Struct.new(:period, :amount_due_ngn, :amount_allocated_ngn,
                          :excluded, :unresolved, keyword_init: true)

  module DuesCalculator
    module_function

    def month(value)
      string = value.to_s
      string += '-01' if string.match?(/^\d{4}-\d{2}$/)
      date = value.is_a?(Date) ? value : Date.parse(string)
      Date.new(date.year, date.month, 1)
    end

    def writeoff_applies?(writeoff_2023:, period:)
      writeoff_2023 && month(period) <= WRITEOFF_LAST_MONTH && month(period).year != EXCLUDED_YEAR
    end

    def obligation_amount(writeoff_2023:, period:)
      return 0 if month(period).year == EXCLUDED_YEAR

      writeoff_applies?(writeoff_2023: writeoff_2023, period: period) ? WRITEOFF_PAYABLE_NGN : DUES_AMOUNT_NGN
    end

    def outstanding(obligations:, as_of:)
      cutoff = month(as_of)
      obligations.sum do |due|
        next 0 if due.excluded || due.unresolved || due.period > cutoff

        remaining(due)
      end
    end

    def remaining(due)
      [due.amount_due_ngn - due.amount_allocated_ngn, 0].max
    end

    # Returns the exact full-obligation allocations for a live payment. It does
    # not support partial allocations: an amount must clear each selected due.
    def allocate_oldest_first(obligations:, payment_amount_ngn:)
      remaining_payment = payment_amount_ngn
      allocations = []
      obligations.sort_by(&:period).each do |due|
        next if due.excluded || due.unresolved || remaining(due).zero?

        required = remaining(due)
        break if remaining_payment < required

        allocations << [due, required]
        remaining_payment -= required
      end
      raise ArgumentError, 'payment cannot be allocated without a partial payment' unless remaining_payment.zero?

      allocations
    end

    # The sequence begins at the earliest known applicable historical liability,
    # not automatically at the regular dues start. This preserves valid write-off
    # obligations that predate that metadata. Unknown periods prevent claiming a
    # consecutive paid-up date. Excluded 2020 months are skipped; prepayments
    # are honoured when their sequence is clear.
    def paid_up_to(obligations:, regular_dues_start_month:, as_of:)
      earliest_relevant_period = obligations.reject(&:excluded).map(&:period).min
      current = [month(regular_dues_start_month), earliest_relevant_period].compact.min
      upper_bound = [month(as_of), obligations.map(&:period).max].compact.max
      paid_through = nil
      index = obligations.group_by(&:period)

      while current <= upper_bound
        if current.year == EXCLUDED_YEAR
          current = next_month(current)
          next
        end
        period_dues = index[current]
        break if period_dues.nil? || period_dues.any?(&:unresolved) || period_dues.any? { |due| !due.excluded && remaining(due).positive? }

        paid_through = current unless period_dues.all?(&:excluded)
        current = next_month(current)
      end
      paid_through
    end

    def next_month(period)
      period.month == 12 ? Date.new(period.year + 1, 1, 1) : Date.new(period.year, period.month + 1, 1)
    end
  end
end
