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
resources :widgets
get "/widgets/:id", to: "admin/widgets#show"
belongs_to :account
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
          reference_name: "widgets",
          candidate_metadata: expect.objectContaining({
            route_form: "resources",
            controller_candidate: "WidgetsController"
          })
        }),
        expect.objectContaining({
          reference_kind: "ruby_route",
          reference_name: "Admin.WidgetsController#show",
          candidate_metadata: expect.objectContaining({
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
      "belongs_to",
      "require",
      "require_relative"
    ]));

    const includeDynamic = dynamic.find((reference) => reference.reference_name === "include");
    const resourcesDynamic = dynamic.find((reference) => reference.reference_name === "resources");
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
