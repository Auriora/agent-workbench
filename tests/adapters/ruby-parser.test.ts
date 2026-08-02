/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import { RubyTreeSitterExtractorAdapter } from "../../src/infrastructure/tree-sitter/index.js";
import { extractRuby, RubyParserAdapter } from "../../src/infrastructure/tree-sitter/ruby-parser.js";

describe("ruby tree-sitter extractor", () => {
  it("extracts class/module/method declarations and route/model DSL references", async () => {
    const extractor = new RubyTreeSitterExtractorAdapter();
    const result = await extractor.extract({
      snapshot_id: "snapshot-1",
      path: "app/models/widget.rb",
      language: "ruby",
      content: `
module Tracking
  module Active
    class Widget < ApplicationRecord
      APP_NAME = "widget"

      include Trackable
      extend ActiveSupport::Concern

      def show
        json = JSON.parse("{}")
        render :json
      end
    end
  end
end

require "json"
require_relative "support/widget"
class WidgetsController
  def show
  end
end

module Admin
  class WidgetsController
    def show
    end
  end
end
resources :widgets
namespace :admin do
  resources :widgets
  get "/widgets/:id" => "widgets#show"
end
get "/admin/widgets/:id" => "admin/widgets#show"
root "home#index"
root to: "landing#index"
root dynamic_root_target
namespace :admin do
  root "dashboard#index"
end
resource :session
    belongs_to :account
    has_many :active_accounts, -> { active }, through: :active_memberships, source: :account
    has_many :published_paragraphs, through: :articles, source: :paragraphs
    has_many :orders, class_name: "Checkout"
    has_many :line_items, class_name: "::Commerce::Billing::Checkout"
    `
    });

    const names = result.nodes.map((node) => node.qualified_name);
    expect(names).toEqual(expect.arrayContaining([
      "app.models.widget",
      "Tracking",
      "Tracking.Active",
      "Tracking.Active.Widget",
      "Tracking.Active.Widget#show"
    ]));

    expect(result.unresolved_references).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reference_kind: "ruby_inheritance",
          reference_name: "ApplicationRecord",
          candidate_metadata: expect.objectContaining({ reference_scope: "class_inheritance" })
        }),
        expect.objectContaining({
          reference_kind: "ruby_require",
          reference_name: "json",
          candidate_metadata: expect.objectContaining({ kind: "require" })
        }),
        expect.objectContaining({
          reference_kind: "ruby_require_relative",
          reference_name: "support/widget",
          candidate_metadata: expect.objectContaining({ kind: "require_relative" })
        }),
        expect.objectContaining({
          reference_kind: "ruby_include",
          reference_name: "Trackable"
        }),
        expect.objectContaining({
          reference_kind: "ruby_extend",
          reference_name: "ActiveSupport.Concern",
          candidate_metadata: expect.objectContaining({ mixin_name: "extend" })
        }),
        expect.objectContaining({
          reference_kind: "ruby_route",
          reference_name: "HomeController#index",
          candidate_metadata: expect.objectContaining({
            route_form: "root",
            route_namespace: "",
            route_controller: "home",
            route_action: "index",
            controller_action_candidate: true
          })
        }),
        expect.objectContaining({
          reference_kind: "ruby_route",
          reference_name: "LandingController#index",
          candidate_metadata: expect.objectContaining({
            route_form: "root",
            route_namespace: "",
            route_controller: "landing",
            route_action: "index",
            controller_action_candidate: true
          })
        }),
        expect.objectContaining({
          reference_kind: "ruby_route",
          reference_name: "Admin.DashboardController#index",
          candidate_metadata: expect.objectContaining({
            route_form: "root",
            route_namespace: "admin",
            route_controller: "admin/dashboard",
            route_action: "index",
            controller_action_candidate: true
          })
        }),
        expect.objectContaining({
          reference_kind: "ruby_dynamic",
          reference_name: "root",
          candidate_metadata: expect.objectContaining({
            route_form: "root",
            reason: "non_literal_route_target",
            route_path: "/",
            static: false
          })
        }),
        expect.objectContaining({
          reference_kind: "ruby_route",
          reference_name: "widgets",
          candidate_metadata: expect.objectContaining({
            route_form: "resources",
            route_namespace: "",
            controller_candidate: "WidgetsController"
          })
        }),
        expect.objectContaining({
          reference_kind: "ruby_route",
          reference_name: "session",
          candidate_metadata: expect.objectContaining({
            route_form: "resource",
            route_namespace: "",
            controller_candidate: "SessionsController"
          })
        }),
        expect.objectContaining({
          reference_kind: "ruby_route",
          reference_name: "widgets",
          candidate_metadata: expect.objectContaining({
            route_form: "resources",
            route_namespace: "admin",
            route_scope: "admin/widgets",
            controller_candidate: "Admin.WidgetsController"
          })
        }),
        expect.objectContaining({
          reference_kind: "ruby_route",
          reference_name: "Admin.WidgetsController#show",
          candidate_metadata: expect.objectContaining({
            route_namespace: "",
            route_controller: "admin/widgets",
            route_action: "show",
            controller_action_candidate: true
          })
        }),
        expect.objectContaining({
          reference_kind: "ruby_model_dsl",
          reference_name: "account",
          candidate_metadata: expect.objectContaining({ model_form: "belongs_to" })
        }),
        expect.objectContaining({
          reference_kind: "ruby_model_dsl",
          reference_name: "orders",
          candidate_metadata: expect.objectContaining({
            model_form: "has_many",
            class_name: "Checkout"
          })
        }),
        expect.objectContaining({
          reference_kind: "ruby_model_dsl",
          reference_name: "line_items",
          candidate_metadata: expect.objectContaining({
            model_form: "has_many",
            class_name: "Commerce.Billing.Checkout"
          })
        }),
        expect.objectContaining({
          reference_kind: "ruby_model_dsl",
          reference_name: "active_accounts",
          candidate_metadata: expect.objectContaining({
            model_form: "has_many",
            model_through: "active_memberships",
            model_source: "account"
          })
        }),
        expect.objectContaining({
          reference_kind: "ruby_model_dsl",
          reference_name: "published_paragraphs",
          candidate_metadata: expect.objectContaining({
            model_form: "has_many",
            model_through: "articles",
            model_source: "paragraphs"
          })
        }),
        expect.objectContaining({
          reference_kind: "ruby_call",
          reference_name: "render",
          candidate_metadata: expect.objectContaining({ call_form: "generic" })
        }),
        expect.objectContaining({
          reference_kind: "ruby_constant",
          reference_name: "JSON",
          candidate_metadata: expect.objectContaining({ reference_scope: "static_constant" })
        })
      ])
    );
  });

  it("marks reopened modules and classes with deterministic metadata", () => {
    const reopened = extractRuby(`
module Tracking
  class Widget
    VERSION = 2
  end

  class Widget
    VERSION = 3
  end
end

module Tracking
  VERSION = 4
end
`);

    const classSecond = reopened.declarations.find((declaration) => declaration.qualifiedName === "Tracking.Widget" && declaration.metadata.reopened === true);
    const moduleSecond = reopened.declarations.find((declaration) =>
      declaration.qualifiedName === "Tracking" && declaration.kind === "module" && declaration.metadata.reopened === true
    );

    expect(classSecond).toEqual(
      expect.objectContaining({
        kind: "class",
        name: "Widget",
        metadata: expect.objectContaining({
          reopened: true,
          reopen_sequence: 2
        })
      })
    );
    expect(moduleSecond).toEqual(
      expect.objectContaining({
        kind: "module",
        name: "Tracking",
        metadata: expect.objectContaining({
          reopened: true,
          reopen_sequence: 2
        })
      })
    );
  });

  it("preserves singleton_class declaration identity while canonicalizing singleton methods to owner", () => {
    const result = extractRuby(`
class Widget
  class << self
    def helper
    end
  end
  def self.api_version
  end
end
`);
    expect(result.declarations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "singleton_class",
        name: "<<self>>",
        qualifiedName: "Widget.<<self>>"
      }),
      expect.objectContaining({
        kind: "singleton_method",
        name: "helper",
        qualifiedName: "Widget.helper"
      }),
      expect.objectContaining({
        kind: "singleton_method",
        name: "api_version",
        qualifiedName: "Widget.api_version"
      })
    ]));
  });

  it("tracks scoped route options, custom action inference, and draw file targets", () => {
    const references = extractRuby(`
resources :projects, module: :admin, path: "project_items", controller: "projects_admin" do
  member do
    get :preview
  end
  collection do
    get :search
  end
  get :archive, on: :member
end
get "/explicit", controller: "admin/widgets", action: "show"
scope "/portal" do
  get "/status" => "health#status"
end
namespace :api do
  resources :projects, path: "/api_projects"
end
scope module: :admin do
  resources :widgets
end
draw :admin
`, "config/routes.rb");

    const routeRefs = references.references.filter((reference) => reference.kind === "ruby_route");
    expect(routeRefs).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: "project_items",
        metadata: expect.objectContaining({
          route_form: "resources",
          route_namespace: "admin",
          route_path_prefix: "",
          controller_candidate: "Admin.ProjectsAdminController"
        })
      }),
      expect.objectContaining({
        name: "Admin.ProjectsAdminController#preview",
        metadata: expect.objectContaining({
          route_form: "get",
          route_namespace: "admin",
          route_path_prefix: "project_items",
          route_controller: "admin/projects_admin",
          route_action: "preview",
          route_action_scope: "member",
          controller_action_candidate: true
        })
      }),
      expect.objectContaining({
        name: "Admin.ProjectsAdminController#search",
        metadata: expect.objectContaining({
          route_form: "get",
          route_namespace: "admin",
          route_path_prefix: "project_items",
          route_controller: "admin/projects_admin",
          route_action: "search",
          route_action_scope: "collection",
          controller_action_candidate: true
        })
      }),
      expect.objectContaining({
        name: "Admin.ProjectsAdminController#archive",
        metadata: expect.objectContaining({
          route_form: "get",
          route_namespace: "admin",
          route_path_prefix: "project_items",
          route_controller: "admin/projects_admin",
          route_action: "archive",
          route_action_scope: "member",
          controller_action_candidate: true
        })
      }),
      expect.objectContaining({
        name: "Admin.WidgetsController#show",
        metadata: expect.objectContaining({
          route_form: "get",
          route_namespace: "",
          route_controller: "admin/widgets",
          route_action: "show",
          controller_action_candidate: true
        })
      }),
      expect.objectContaining({
        name: "HealthController#status",
        metadata: expect.objectContaining({
          route_form: "get",
          route_namespace: "",
          route_path_prefix: "portal",
          route_controller: "health",
          route_action: "status",
          controller_action_candidate: true
        })
      }),
      expect.objectContaining({
        name: "api_projects",
        metadata: expect.objectContaining({
          route_form: "resources",
          route_namespace: "api",
          route_path_prefix: "api",
          controller_candidate: "Api.ProjectsController"
        })
      }),
      expect.objectContaining({
        name: "admin",
        metadata: expect.objectContaining({
          route_form: "draw",
          route_namespace: "",
          route_path_prefix: "",
          route_file_candidate: "config/routes/admin.rb"
        })
      }),
      expect.objectContaining({
        name: "widgets",
        metadata: expect.objectContaining({
          route_form: "resources",
          route_namespace: "admin",
          route_path_prefix: "",
          controller_candidate: "Admin.WidgetsController"
        })
      })
    ]));

    const dynamicOptionRefs = extractRuby(
      `get "/dynamic", controller: dynamic_controller, action: "show"`,
      "config/routes.rb"
    ).references;
    expect(dynamicOptionRefs).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "ruby_dynamic",
        name: "get",
        metadata: expect.objectContaining({
          static: false,
          reason: "non_literal_route_target"
        })
      })
    ]));
  });

  it("captures conservative load/autoload, alias, and visibility metadata", () => {
    const references = extractRuby(`
alias public_name full_name
private
private :secret_method, :other_method
load "app/bootstrap.rb"
autoload :Loader, "app/loader"
autoload_relative :LoaderRelative, "app/loader_relative"
`);

    const visibilityRefs = references.references.filter((reference) => reference.kind === "ruby_visibility");
    const aliasRefs = references.references.filter((reference) => reference.kind === "ruby_alias");
    const loadRefs = references.references.filter((reference) => reference.kind === "ruby_load");

    expect(visibilityRefs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "private",
          metadata: expect.objectContaining({
            visibility: "private",
            visibility_targets: []
          })
        }),
        expect.objectContaining({
          name: "private",
          metadata: expect.objectContaining({
            visibility: "private",
            visibility_targets: ["secret_method", "other_method"]
          })
        })
      ])
    );

    expect(aliasRefs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "full_name",
          metadata: expect.objectContaining({
            alias_from: "public_name",
            alias_to: "full_name"
          })
        })
      ])
    );

    expect(loadRefs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "app/bootstrap.rb",
          metadata: expect.objectContaining({
            load_form: "load",
            load_target: "app/bootstrap.rb"
          })
        }),
        expect.objectContaining({
          name: "app/loader",
          metadata: expect.objectContaining({
            load_form: "autoload",
            load_target: "app/loader",
            load_symbol: "Loader"
          })
        }),
        expect.objectContaining({
          name: "app/loader_relative",
          metadata: expect.objectContaining({
            load_form: "autoload_relative",
            load_target: "app/loader_relative",
            load_symbol: "LoaderRelative"
          })
        })
      ])
    );

    const dynamicLoadRefs = extractRuby(`load dynamic_path`).references;
    expect(dynamicLoadRefs).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "ruby_dynamic",
        name: "load",
        metadata: expect.objectContaining({
          static: false,
          reason: "non_literal_load_target"
        })
      })
    ]));
  });

  it("captures advisory model metadata for source_type and polymorphic associations", () => {
    const references = extractRuby(`
has_many :editions, through: :shelves, source: :format, source_type: "Paperback"
belongs_to :imageable, polymorphic: true
`, "app/models/publication.rb").references.filter((reference) => reference.kind === "ruby_model_dsl");

    expect(references).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "editions",
          metadata: expect.objectContaining({
            model_form: "has_many",
            model_source_type: "Paperback",
            model_through: "shelves",
            model_source: "format"
          })
        }),
        expect.objectContaining({
          name: "imageable",
          metadata: expect.objectContaining({
            model_form: "belongs_to",
            model_polymorphic: true
          })
        })
      ])
    );

    const dynamicSourceType = extractRuby(
      `has_many :editions, through: :shelves, source: :format, source_type: dynamic_type`
    ).references;
    expect(dynamicSourceType).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "ruby_dynamic",
        name: "has_many",
        metadata: expect.objectContaining({
          static: false,
          reason: "non_literal_model_dsl_argument"
        })
      })
    ]));
  });

  it("keeps constant assignments as declarations", () => {
    const references = extractRuby(`
module X
  class Y
    VERSION = 2
  end
end
`).declarations.map((declaration) => declaration.kind + ":" + declaration.qualifiedName);

    expect(references).toContain("constant:X.Y.VERSION");
  });

  it("propagates parser failures and rejects without fallback", async () => {
    const parserError = new Error("ruby parser failure");
    const parser = {
      parse: () => {
        throw parserError;
      }
    };

    const adapter = new RubyParserAdapter({ parser });
    expect(() => adapter.extractRuby("class Widget; end")).toThrow(parserError);

    const extractor = new RubyTreeSitterExtractorAdapter({ parser: adapter });
    await expect(extractor.extract({
      snapshot_id: "snapshot-failure",
      path: "app/models/widget.rb",
      language: "ruby",
      content: "class Widget; end"
    })).rejects.toThrow(parserError);
  });

  it("keeps nonliteral Rails DSL arguments as dynamic evidence and does not pretend static resolution", async () => {
    const extractor = new RubyTreeSitterExtractorAdapter();
    const result = await extractor.extract({
      snapshot_id: "snapshot-2",
      path: "app/controllers/widgets_controller.rb",
      language: "ruby",
      content: `
module Tracking
  include dynamic_module
  resources resource_name
  get "/computed", to: route_target
  belongs_to account_name
  require send("json")
  require_relative base_path
`
    });

    const dynamic = result.unresolved_references.filter((reference) => reference.reference_kind === "ruby_dynamic");
    const dynamicNames = dynamic.map((reference) => reference.reference_name);
    expect(dynamicNames).toEqual(expect.arrayContaining([
      "include",
      "resources",
      "get",
      "belongs_to",
      "require",
      "require_relative"
    ]));

    const includeDynamic = dynamic.find((reference) => reference.reference_name === "include");
    const resourcesDynamic = dynamic.find((reference) => reference.reference_name === "resources");
    const routeTargetDynamic = dynamic.find((reference) =>
      reference.reference_name === "get" && reference.candidate_metadata.reason === "non_literal_route_target"
    );
    const belongsToDynamic = dynamic.find((reference) => reference.reference_name === "belongs_to");
    const requireDynamic = dynamic.find((reference) => reference.reference_name === "require");
    const requireRelativeDynamic = dynamic.find((reference) => reference.reference_name === "require_relative");

    expect(includeDynamic).toEqual(expect.objectContaining({
      reference_kind: "ruby_dynamic",
      candidate_metadata: expect.objectContaining({
        static: false,
        mixin_name: "include",
        reason: "non_literal_argument"
      })
    }));
    expect(resourcesDynamic).toEqual(expect.objectContaining({
      reference_kind: "ruby_dynamic",
      candidate_metadata: expect.objectContaining({
        static: false,
        reason: "non_literal_resource_name"
      })
    }));
    expect(routeTargetDynamic).toEqual(expect.objectContaining({
      reference_kind: "ruby_dynamic",
      candidate_metadata: expect.objectContaining({
        static: false,
        route_form: "get",
        route_path: "/computed",
        reason: "non_literal_route_target"
      })
    }));
    expect(belongsToDynamic).toEqual(expect.objectContaining({
      reference_kind: "ruby_dynamic",
      candidate_metadata: expect.objectContaining({
        static: false,
        reason: "non_literal_model_dsl_argument"
      })
    }));
    expect(requireDynamic).toEqual(expect.objectContaining({
      reference_kind: "ruby_dynamic",
      candidate_metadata: expect.objectContaining({
        static: false,
        reason: "non_literal_argument"
      })
    }));
    expect(requireRelativeDynamic).toEqual(expect.objectContaining({
      reference_kind: "ruby_dynamic",
      candidate_metadata: expect.objectContaining({
        static: false,
        reason: "non_literal_argument"
      })
    }));
  });
});
