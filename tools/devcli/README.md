# Dev CLI

This package provides the default developer interface for the template.

## Install

```bash
pip install --no-build-isolation -e tools/devcli
```

## Commands

```bash
proj setup
proj dev
proj lint
proj test
proj spec show
proj spec scaffold-split requirements
proj spec new-task "fix login timeout"
```

Replace the placeholder command implementations in `src/auriora_dev/cli.py` with project-specific behavior.
Task files use grouped Kiro-style checklists with `[ ]`, `[-]`, and `[x]`, plus numbered tasks and sub-tasks.
