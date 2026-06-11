import { describe, expect, it } from "vitest";
import type { ExtractionRequest } from "../../src/domain/models/index.js";
import { cloudFormationTemplateExtraction } from "../../src/infrastructure/extraction/cloudformation-resource-extractor.js";
import { cmakeTargetNodes } from "../../src/infrastructure/extraction/cmake-resource-extractor.js";
import { dotnetResourceNodes } from "../../src/infrastructure/extraction/dotnet-resource-extractor.js";

describe("resource extractor rule units", () => {
  it("extracts CMake target routing evidence without generator expressions", () => {
    const nodes = cmakeTargetNodes(
      extractionRequest({
        path: "CMakeLists.txt",
        language: "cmake",
        content: [
          "add_library(core src/core.cpp $<TARGET_OBJECTS:generated>)",
          "add_executable(service_tests tests/service_tests.cpp src/service.cpp)"
        ].join("\n")
      })
    );

    expect(nodes).toHaveLength(2);
    expect(nodes.map((node) => node.kind)).toEqual(["cmake_library", "cmake_executable"]);
    expect(nodes[0]).toMatchObject({
      name: "core",
      metadata: {
        provenance: "cmake_target_scan",
        sources: ["src/core.cpp"]
      }
    });
    expect(nodes[1]).toMatchObject({
      name: "service_tests",
      metadata: {
        sources: ["tests/service_tests.cpp", "src/service.cpp"]
      }
    });
  });

  it("extracts .NET project metadata without SQLite graph setup", () => {
    const nodes = dotnetResourceNodes(
      extractionRequest({
        path: "tests/Orders.Tests/Orders.Tests.csproj",
        language: "xml",
        content: [
          '<Project Sdk="Microsoft.NET.Sdk">',
          "  <PropertyGroup>",
          "    <TargetFrameworks>net8.0;net9.0</TargetFrameworks>",
          "    <IsTestProject>true</IsTestProject>",
          "  </PropertyGroup>",
          '  <ItemGroup>',
          '    <PackageReference Include="xunit" Version="2.8.1" />',
          '    <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.10.0" />',
          '    <ProjectReference Include="..\\Orders\\Orders.csproj" />',
          "  </ItemGroup>",
          "</Project>"
        ].join("\n")
      })
    );

    expect(nodes).toEqual([
      expect.objectContaining({
        kind: "dotnet_project",
        name: "Orders.Tests.csproj",
        signature: "net8.0;net9.0",
        metadata: expect.objectContaining({
          provenance: "dotnet_project_scan",
          target_frameworks: ["net8.0", "net9.0"],
          package_references: ["Microsoft.NET.Test.Sdk", "xunit"],
          project_references: ["../Orders/Orders.csproj"],
          is_test_project: true
        })
      })
    ]);
  });

  it("extracts CloudFormation handlers, event sources, and intrinsic references", () => {
    const extraction = cloudFormationTemplateExtraction(
      extractionRequest({
        path: "infra/sam/template.yaml",
        language: "yaml",
        content: [
          "AWSTemplateFormatVersion: '2010-09-09'",
          "Transform: AWS::Serverless-2016-10-31",
          "Resources:",
          "  OrdersFunction:",
          "    Type: AWS::Serverless::Function",
          "    Properties:",
          "      Handler: src/orders/app.handler",
          "      Events:",
          "        Api:",
          "          Type: Api",
          "      Environment:",
          "        Variables:",
          "          TABLE_NAME: !Ref OrdersTable",
          "          SHARED_TOPIC: !ImportValue SharedTopicArn",
          "  OrdersTable:",
          "    Type: AWS::DynamoDB::Table"
        ].join("\n")
      })
    );

    expect(extraction.nodes.map((node) => node.kind).sort()).toEqual([
      "cloudformation_resource",
      "lambda_event_source",
      "lambda_function",
      "lambda_handler_binding"
    ]);
    expect(extraction.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "lambda_handler_binding",
          name: "src/orders/app.handler",
          metadata: expect.objectContaining({
            handler_file_candidate: "src/orders/app.py",
            handler_export_candidate: "handler",
            event_sources: ["Api:Api"]
          })
        }),
        expect.objectContaining({
          kind: "lambda_event_source",
          name: "Api",
          metadata: expect.objectContaining({
            event_type: "Api"
          })
        })
      ])
    );
    expect(extraction.edges.map((edge) => edge.kind).sort()).toEqual([
      "lambda_event_source",
      "lambda_event_source",
      "routes_to_template_resource"
    ]);
    expect(extraction.unresolved_references).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reference_name: "OrdersTable",
          reference_kind: "cloudformation_ref"
        }),
        expect.objectContaining({
          reference_name: "SharedTopicArn",
          reference_kind: "cloudformation_import_value"
        })
      ])
    );
  });
});

function extractionRequest(input: {
  path: string;
  language: string;
  content: string;
}): ExtractionRequest {
  return {
    snapshot_id: "snapshot-1",
    path: input.path,
    language: input.language,
    content: input.content
  };
}
