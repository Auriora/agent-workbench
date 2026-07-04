# Copyright (C) 2026 Auriora
# SPDX-License-Identifier: GPL-3.0-or-later

from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any

import typer


def _scalar(conn: sqlite3.Connection, sql: str) -> int | str:
    try:
        value = conn.execute(sql).fetchone()
    except sqlite3.Error:
        return "unavailable"
    if value is None:
        return 0
    return value[0] if value[0] is not None else 0


def _scalar_any(conn: sqlite3.Connection, queries: tuple[str, ...]) -> int | str:
    for sql in queries:
        value = _scalar(conn, sql)
        if value != "unavailable":
            return value
    return "unavailable"


def inspect_database(db: Path) -> dict[str, Any]:
    result: dict[str, Any] = {
        "database": str(db),
        "status": "missing",
        "size_bytes": 0,
    }
    if not db.exists():
        return result

    result["status"] = "present"
    result["size_bytes"] = db.stat().st_size
    uri = f"file:{db}?mode=ro"
    with sqlite3.connect(uri, uri=True) as conn:
        tables = {
            row[0]
            for row in conn.execute("select name from sqlite_master where type = 'table'")
        }
        result["tables"] = sorted(tables)
        metrics = {
            "snapshots": ("select count(*) from snapshots",),
            "files": ("select count(*) from files",),
            "nodes": ("select count(*) from nodes",),
            "edges": ("select count(*) from edges",),
            "docs": (
                "select count(*) from docs_documents",
                "select count(*) from docs",
            ),
            "unresolved_references": (
                "select count(*) from unresolved_refs",
                "select count(*) from unresolved_references",
            ),
            "node_fts_rows": ("select count(*) from node_fts",),
            "doc_fts_rows": (
                "select count(*) from docs_fts",
                "select count(*) from doc_fts",
            ),
        }
        result["metrics"] = {name: _scalar_any(conn, sql) for name, sql in metrics.items()}
        result["latest_snapshot"] = _latest_snapshot(conn)
        result["freshness"] = _freshness(conn)
    return result


def _latest_snapshot(conn: sqlite3.Connection) -> dict[str, Any] | str:
    try:
        row = conn.execute(
            "select id, freshness, created_at from snapshots order by created_at desc limit 1"
        ).fetchone()
    except sqlite3.Error:
        return "unavailable"
    if row is None:
        return {}
    return {"id": row[0], "freshness": row[1], "created_at": row[2]}


def _freshness(conn: sqlite3.Connection) -> dict[str, int] | str:
    try:
        rows = conn.execute(
            "select freshness, count(*) from snapshots group by freshness order by freshness"
        ).fetchall()
    except sqlite3.Error:
        return "unavailable"
    return {str(row[0]): int(row[1]) for row in rows}


def _default_db(repo: Path) -> Path:
    return repo / ".cache" / "agent-workbench" / "graph.sqlite"


def _print_text(data: dict[str, Any]) -> None:
    typer.echo(f"database: {data['database']}")
    typer.echo(f"status: {data['status']}")
    typer.echo(f"size_bytes: {data['size_bytes']}")
    if data["status"] == "missing":
        return
    typer.echo("metrics:")
    for name, value in data.get("metrics", {}).items():
        typer.echo(f"- {name}: {value}")
    typer.echo(f"freshness: {data.get('freshness', 'unavailable')}")
    typer.echo(f"latest_snapshot: {data.get('latest_snapshot', 'unavailable')}")


def register(app: typer.Typer) -> None:
    cache_app = typer.Typer(no_args_is_help=True, help="Read-only Agent Workbench cache diagnostics.")

    @cache_app.command("inspect")
    def inspect(
        repo: Path | None = typer.Option(None, "--repo", help="Repository whose cache should be inspected."),
        db: Path | None = typer.Option(None, "--db", help="Graph SQLite database override."),
        json_output: bool = typer.Option(False, "--json", help="Emit JSON."),
    ) -> None:
        if db is None:
            if repo is None:
                raise typer.BadParameter("Provide --repo or --db.")
            db = _default_db(repo.expanduser().resolve())
        data = inspect_database(db.expanduser().resolve())
        if json_output:
            typer.echo(json.dumps(data, indent=2, sort_keys=True))
        else:
            _print_text(data)

    app.add_typer(cache_app, name="cache")
