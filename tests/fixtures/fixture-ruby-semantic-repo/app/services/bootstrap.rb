module Commerce
  module Services
    module Bootstrap
      require "json"
      require_relative "../models/base_record"

      def self.init
        loader_path = "app/services/loader"
        require send("json")
        require_relative loader_path
        include mixin_target
        extend extender
        prepend prepender
        include SharedConfig

        SharedConfig
      end
    end
  end
end
