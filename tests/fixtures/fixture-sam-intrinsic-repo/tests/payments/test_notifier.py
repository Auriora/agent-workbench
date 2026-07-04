# Copyright (C) 2026 Auriora
# SPDX-License-Identifier: GPL-3.0-or-later

from src.payments import notifier


def test_notifier_returns_queued():
    assert notifier.handler({}, None)["statusCode"] == 202
