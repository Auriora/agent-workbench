# Copyright (C) 2026 Auriora
# SPDX-License-Identifier: GPL-3.0-or-later

from __future__ import annotations

import typer

from auriora_dev.commands import cache, check, doctor, mcp, package, plugin, release, spec


app = typer.Typer(
    no_args_is_help=True,
    help="Agent Workbench developer CLI.",
)

check.register(app)
doctor.register(app)
package.register(app)
plugin.register(app)
mcp.register(app)
cache.register(app)
spec.register(app)
release.register(app)
