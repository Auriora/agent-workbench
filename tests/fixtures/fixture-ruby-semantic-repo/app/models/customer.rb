module Commerce
  class Customer < BaseRecord
    has_many :orders
    has_many :orders, class_name: "Checkout"
    has_many :active_accounts, -> { active }, through: :active_memberships, source: :account
    has_many :published_paragraphs, through: :articles, source: :paragraphs
    has_many :line_items, class_name: "::Commerce::Billing::Checkout"
    belongs_to :account
    validates :session
    has_one :profile
    belongs_to :imageable, polymorphic: true
    has_many :editions, through: :books, source: :format, source_type: "Paperback"
    has_and_belongs_to_many :tags
    validates :name, presence: true
    belongs_to dynamic_account
  end
end
