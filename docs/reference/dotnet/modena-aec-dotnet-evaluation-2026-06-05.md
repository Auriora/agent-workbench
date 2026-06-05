---
title: Modena AEC .NET repository evaluation
doc_type: reference
status: draft
owner: platform
last_reviewed: 2026-06-05
---

# Modena AEC .NET repository evaluation

This note records an Agent Workbench exploration of
`/home/bcherrington/Projects/Clients/Modena AEC/One-Register-Web-Application`
from Codex on 2026-06-05. The target is a multi-project .NET 8 repository with
ASP.NET Core, Blazor Server, Blazor WebAssembly, DevExpress reporting, EF Core,
and shared model projects.

## Repository shape observed

Direct repository inspection found these primary .NET entry points:

- `Modena Drawing Register Webassembly.sln`
- `Modena Drawing Register Server App/Modena Drawing Register Server App.sln`
- `Modena Drawing Register API/Modena Drawing Register API.csproj`
- `Modena Drawing Register Server App/Modena Drawing Register Server App.csproj`
- `Modena Drawing Register Webassembly/Modena Drawing Register Webassembly.csproj`
- `ReportingTool/ReportingTool.csproj`
- `Shared/Shared.csproj`

The project files target `net8.0`. The API uses `Microsoft.NET.Sdk.Web`,
JWT authentication, EF Core SQL Server, Swagger, Autodesk Forge, and a project
reference to `Shared`. The server app uses Blazor Server, DevExpress reporting,
SignalR client packages, and references both the API and `Shared`. The
WebAssembly app uses `Microsoft.NET.Sdk.BlazorWebAssembly`. `ReportingTool` is a
separate web project with DevExpress reporting and SQLite dependencies.

## Agent Workbench behavior

`repo:///status`, `repo:///scope`, and `repo:///overview` returned fresh,
resource-backed output and correctly identified C#, JavaScript, JSON, Markdown,
and text content. The scope response also warned that unsupported
language/platform coverage was present and that direct reads or rule-based
routing should be preferred for those files.

The indexed scope included 118 C# files, 13 JavaScript files, 57 JSON files, one
Markdown file, and 1811 text files. The status output showed C# files such as
controllers, services, repositories, EF migrations, middleware, models, and
interfaces under the API project, but C# capability was reported as
`unsupported` rather than semantic or partial semantic.

`context_for_task` was helpful as a structured workflow step, but for a broad
task phrased around evaluating a `.NET/C# web application`, it ranked generated
`bin/Debug/net8.0` runtime assets such as `dotnet.js`, `dotnet.runtime.js`,
`.wasm`, `.gz`, and `.map` files ahead of source files and project files. It
also selected an Open Iconic README as the governing doc because no project
README or solution-level documentation was available.

`verification_plan` was blocked when given the actual `.csproj` files. It
planned zero commands and reported low confidence plus missing validation
evidence. It did not infer obvious local validation commands such as
`dotnet build` for the solution or individual project files.

## What worked

- The runtime started cleanly and reported a fresh repository snapshot.
- Scope and status gave useful high-level inventory data without shell access.
- Generated/vendor root skip lists were explicit and easy to audit.
- The tool was honest about unsupported C# coverage and blocked validation
  instead of pretending validation was covered.
- The Codex integration profile clearly described active MCP, skill, plugin,
  and hook surfaces.

## Gaps for .NET support

- C# source is only file-identity evidence today. There is no symbol ranking,
  reference lookup, impact analysis, or semantic routing for controllers,
  services, Razor components, EF contexts, migrations, or shared models.
- Build output is not excluded strongly enough. `bin/Debug/net8.0` assets
  dominated task context even though `bin` should normally be treated as
  generated output for .NET repositories.
- `.sln` and `.csproj` files are not promoted as first-class architecture
  anchors. They are the fastest way to identify project graph, target
  frameworks, SDK type, package families, and validation commands.
- Razor files are not surfaced as Blazor components. This hides most of the UI
  application structure in Blazor Server and WebAssembly projects.
- Validation planning does not yet know .NET conventions. It should recognize
  solution and project files and propose non-executed command candidates such as
  `dotnet build <solution-or-project>` and, when test projects exist,
  `dotnet test`.
- Task-context ranking appears too path-term driven for broad .NET tasks. It
  matched `dotnet` runtime asset names instead of source and configuration that
  explain the application.

## Recommended improvements

- Add .NET generated-output rules for `bin/`, `obj/`, `TestResults/`,
  `packages/`, publish output, generated framework assets, `.dll`, `.pdb`,
  `.wasm`, `.gz`, and source maps unless explicitly requested.
- Add a `.sln` and `.csproj` resource-backed adapter that extracts target
  frameworks, SDK type, package references, project references, output type, and
  likely app role.
- Promote project files, `Program.cs`, `appsettings*.json`, Razor route pages,
  controllers, EF `DbContext`, migrations, and shared model projects in
  `context_for_task` for .NET repositories.
- Add validation planning rules for `dotnet build` and `dotnet test`, preferring
  the nearest solution when available and falling back to explicit project files
  when no solution is present.
- Add partial semantic C# and Razor support with tree-sitter or another
  approved single implementation path once the design and fixture tests justify
  it.
- Add fixture coverage for a multi-project .NET repository with spaces in paths,
  Blazor Server, Blazor WebAssembly, ASP.NET Core API, EF migrations, and a
  shared library.

## Open questions

- Should .NET support start as resource-backed project graph extraction before
  C# semantic indexing, or should both land behind one fixture-backed feature?
- Should validation planning emit `dotnet build` candidates for repositories
  with no test projects, or remain blocked until a solution-level validation
  policy exists?
- Should generated-output exclusion be global for all ecosystems or expressed
  through ecosystem-specific generated roots so `.NET` build assets do not
  crowd routing results?
