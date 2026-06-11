import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("SAM intrinsic fixture", () => {
  const root = path.resolve("tests/fixtures/fixture-sam-intrinsic-repo");

  it("covers YAML, JSON, handlers, tests, validation policy, and secret-like values", () => {
    const files = [
      "infra/orders/template.yaml",
      "infra/shared/template.json",
      "src/orders/app.py",
      "src/payments/notifier.py",
      "tests/orders/test_app.py",
      "tests/payments/test_notifier.py",
      ".agent-workbench/validation-policy.json"
    ];

    expectSamFixtureInventory(root, files);

    const ordersTemplate = fs.readFileSync(path.join(root, "infra/orders/template.yaml"), "utf8");
    const sharedTemplate = fs.readFileSync(path.join(root, "infra/shared/template.json"), "utf8");
    const validationPolicy = fs.readFileSync(path.join(root, ".agent-workbench/validation-policy.json"), "utf8");

    expectYamlIntrinsicScenario(ordersTemplate);
    expectJsonIntrinsicScenario(sharedTemplate);
    expectValidationPolicyScenario(validationPolicy);
  });
});

function expectSamFixtureInventory(root: string, files: string[]): void {
  for (const file of files) {
    expect(fs.existsSync(path.join(root, file)), file).toBe(true);
  }
}

function expectYamlIntrinsicScenario(ordersTemplate: string): void {
  expect(ordersTemplate).toContain("!Ref OrdersTable");
  expect(ordersTemplate).toContain("!GetAtt OrdersQueue.Arn");
  expect(ordersTemplate).toContain("Fn::Join:");
  expect(ordersTemplate).toContain("Fn::If:");
  expect(ordersTemplate).toContain("Fn::ImportValue: SharedOrdersTopicArn");
  expect(ordersTemplate).toContain("DependsOn: OrdersTable");
  expect(ordersTemplate).toContain("Type: DynamoDB");
  expect(ordersTemplate).toContain("{{resolve:secretsmanager:orders/token:SecretString:value}}");
}

function expectJsonIntrinsicScenario(sharedTemplate: string): void {
  expect(sharedTemplate).toContain("\"Fn::GetAtt\": [\"SharedOrdersTopic\", \"TopicArn\"]");
  expect(sharedTemplate).toContain("\"DependsOn\": \"SharedOrdersTopic\"");
}

function expectValidationPolicyScenario(validationPolicy: string): void {
  expect(validationPolicy).toContain("sam-validate-orders");
  expect(validationPolicy).toContain("cfn-lint-shared");
}
