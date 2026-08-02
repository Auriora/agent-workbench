module Commerce
  class Customer < BaseRecord
    has_many :orders
    has_many :orders, class_name: "Checkout"
    has_many :line_items, class_name: "::Commerce::Billing::Checkout"
    belongs_to :account
    validates :session
    has_one :profile
    validates :name, presence: true
    belongs_to dynamic_account
  end
end
