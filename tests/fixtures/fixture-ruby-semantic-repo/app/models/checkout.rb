module Commerce
  module Billing
    class Checkout < BaseRecord
      DEFAULT_LIMIT = 8
      DEFAULT_CURRENCY = "USD"

      class << self
        def builder_path
          "/checkout"
        end

        def from_total(total)
          total.to_i
        end
      end

      def self.default_currency
        DEFAULT_CURRENCY
      end

      def calculate
        DEFAULT_LIMIT
        include DiscountEngine
        extend Trackable
        prepend EventTracing

        DiscountEngine.apply(self)
        JSON.parse("{}")
        render(:json)
      end

      def self.complete?(amount)
        amount > DEFAULT_LIMIT
      end
    end
  end
end
