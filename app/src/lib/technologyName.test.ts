import assert from "node:assert/strict";
import test from "node:test";
import { capitalizeTechnology, checkTechnologyName, newTechnologies, technologyKey } from "./technologyName.ts";

const listed = ["Power BI", "Power Apps", "Power Automate", "ADO", "Fabric", "Microsoft Teams", "Azure Functions", "Azure AI Search", "PostgreSQL", "Node.js", ".NET", "Python", "SharePoint", "C#", "React"];

test("duplicates ignore case, spacing, punctuation and accents but keep C, C# and C++ distinct", () => {
  for (const input of ["power bi", "PowerBI", "  POWER   BI ", "Power-BI", "nodejs", "Node JS", ".net", "NET", "sharepoint", "PÝTHON"])
    assert.ok(checkTechnologyName(input, listed).existing, input);
  assert.equal(checkTechnologyName("powerbi", listed).existing, "Power BI");
  assert.equal(checkTechnologyName("c#", listed).existing, "C#");
  assert.equal(checkTechnologyName("C++", listed).existing, undefined);
  assert.notEqual(technologyKey("C"), technologyKey("C#"));
});

test("known aliases resolve to the listed canonical name only when it exists", () => {
  assert.equal(checkTechnologyName("Azure DevOps", listed).existing, "ADO");
  assert.equal(checkTechnologyName("Microsoft Fabric", listed).existing, "Fabric");
  assert.equal(checkTechnologyName("teams", listed).existing, "Microsoft Teams");
  assert.equal(checkTechnologyName("Postgres", listed).existing, "PostgreSQL");
  assert.equal(checkTechnologyName("k8s", listed).existing, undefined);
});

test("similar names are suggested without blocking creation", () => {
  assert.deepEqual(checkTechnologyName("Pyhton", listed).similar, ["Python"]);
  assert.deepEqual(checkTechnologyName("Azure Function", listed).similar, ["Azure Functions"]);
  assert.deepEqual(checkTechnologyName("Share Piont", listed).similar, ["SharePoint"]);
  assert.deepEqual(checkTechnologyName("React Native", listed).similar, ["React"]);
  assert.deepEqual(checkTechnologyName("power", listed).similar, ["Power BI", "Power Apps", "Power Automate"]);
  assert.deepEqual(checkTechnologyName("Terraform", listed).similar, []);
  assert.deepEqual(checkTechnologyName("Kubernetes", listed).similar, []);
  assert.deepEqual(checkTechnologyName(".NET Core", listed).similar, [".NET"]);
  assert.equal(checkTechnologyName("Pyhton", listed).error, undefined);
});

test("capitalization fixes lowercase and shouted names but keeps deliberate casing", () => {
  const cases: [string, string][] = [
    ["github actions", "GitHub Actions"], ["terraform", "Terraform"], ["KUBERNETES", "Kubernetes"], ["azure api management", "Azure API Management"],
    ["azure database for postgresql", "Azure Database for PostgreSQL"], ["jquery", "jQuery"], ["jQuery", "jQuery"], ["iOS", "iOS"], ["IBM WATSONX", "IBM Watsonx"],
    ["gpt-4o", "GPT-4o"], ["ci/cd", "CI/CD"], ["asp.net core", "ASP.NET Core"], ["vue.js", "Vue.js"], ["HTML5", "HTML5"], ["SAP S/4HANA", "SAP S/4HANA"],
    ["the graph", "The Graph"], ["pandas", "pandas"], ["3d", "3d"],
  ];
  for (const [input, expected] of cases) assert.equal(capitalizeTechnology(input), expected, input);
  assert.equal(capitalizeTechnology("ado pipelines", listed), "ADO Pipelines");
  assert.equal(capitalizeTechnology("azure ai studio", listed), "Azure AI Studio");
});

test("check reports typed and suggested names with collapsed whitespace", () => {
  const check = checkTechnologyName("  github   actions ", listed);
  assert.equal(check.typed, "github actions");
  assert.equal(check.suggested, "GitHub Actions");
  assert.equal(check.existing, undefined);
  assert.equal(checkTechnologyName("Terraform", listed).suggested, "Terraform");
});

test("invalid names are rejected with a reason", () => {
  for (const input of ["React, Node", "Python; R", "123", "---", "N/A", "none", "Other", "TBD", "a\u0007b"])
    assert.ok(checkTechnologyName(input, listed).error, input);
  assert.equal(checkTechnologyName("R", listed).error, undefined);
  assert.equal(checkTechnologyName("Dynamics 365", listed).error, undefined);
});

test("newTechnologies flags names no other published solution uses, with their look-alikes", () => {
  const labels = ["Azure OpenAI", "Power BI", "Power-BI", "OpenAI on Azure", "Kubernetes"];
  const used = new Set(["Azure OpenAI", "Power BI", "Kubernetes"]);
  const result = newTechnologies(["Power BI", "Power-BI", "OpenAI on Azure", "Kubernetes"], used, labels);
  assert.deepEqual(result.map(entry => entry.name), ["Power-BI", "OpenAI on Azure"]);
  assert.equal(result[0].similar[0], "Power BI", "an exact variant leads");
  assert.ok(result[1].similar.includes("Azure OpenAI"));
  assert.deepEqual(newTechnologies(["Kubernetes"], used, labels), []);
});
