# frozen_string_literal: true

class OrderConfirmationJob < ApplicationJob
  def perform(order_id)
    order_id.to_s
  end
end
