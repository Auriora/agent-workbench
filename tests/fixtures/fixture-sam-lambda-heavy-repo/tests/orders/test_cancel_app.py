# Copyright (C) 2026 Auriora
# SPDX-License-Identifier: GPL-3.0-or-later

from src.orders.cancel import app


def test_cancel_handler_returns_response():
    assert app.handler({}, None)["statusCode"] == 200
