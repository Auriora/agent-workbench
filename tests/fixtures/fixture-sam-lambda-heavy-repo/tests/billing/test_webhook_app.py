# Copyright (C) 2026 Auriora
# SPDX-License-Identifier: GPL-3.0-or-later

from src.billing.webhook import app


def test_webhook_handler_returns_response():
    assert app.handler({}, None)["statusCode"] == 202
