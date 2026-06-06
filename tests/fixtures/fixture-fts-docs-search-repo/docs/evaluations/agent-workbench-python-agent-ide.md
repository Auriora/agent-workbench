# Agent Workbench Python Agent IDE Evaluation

## RepositoryResolver Comparison

The Agent Workbench evaluation compares docs search behavior with Python Agent
IDE. The RepositoryResolver task should rank this evaluation ahead of generic
AI agent guide templates when a query includes Agent Workbench, Python Agent
IDE, evaluation, and RepositoryResolver.

## Search Parity

Python Agent IDE uses SQLite FTS5 for docs search. Agent Workbench should use
FTS-backed ranking and pagination rather than broad scanner string matching.
