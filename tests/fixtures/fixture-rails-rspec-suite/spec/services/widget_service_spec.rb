# frozen_string_literal: true

require 'rails_helper'

describe WidgetService do
  it 'returns true' do
    expect(WidgetService.new.call).to be true
  end
end
