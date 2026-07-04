# Copyright (C) 2026 Auriora
# SPDX-License-Identifier: GPL-3.0-or-later

from sample_service.repository_resolver import RepositoryResolver


def test_resolve_repository() -> None:
    assert RepositoryResolver().resolve_repository("/repo") == "/repo"
