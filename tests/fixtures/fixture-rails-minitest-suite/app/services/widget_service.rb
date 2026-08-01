class WidgetService
  def self.ready?
    true
  end

  def ready?
    self.class.ready?
  end
end
