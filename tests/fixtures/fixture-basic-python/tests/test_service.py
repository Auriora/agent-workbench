# Copyright (C) 2026 Auriora
# SPDX-License-Identifier: GPL-3.0-or-later

from sample_pkg import Runner


def test_runner() -> None:
    assert Runner().run() == "ok"
