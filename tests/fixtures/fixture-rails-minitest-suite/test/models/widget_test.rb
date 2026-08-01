require_relative '../test_helper'

class WidgetTest < Minitest::Test
  def test_widget_name_persists
    widget = Widget.new('example')
    assert_equal 'example', widget.name
  end
end
