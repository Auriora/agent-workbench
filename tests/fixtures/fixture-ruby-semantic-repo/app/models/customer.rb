module Commerce
  class Customer < BaseRecord
    has_many :orders
    belongs_to :account
    has_one :profile
    validates :name, presence: true
    belongs_to dynamic_account
  end
end
