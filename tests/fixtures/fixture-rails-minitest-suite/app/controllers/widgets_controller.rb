class WidgetsController < Object
  def index
    WidgetService.new.ready?
  end
end
