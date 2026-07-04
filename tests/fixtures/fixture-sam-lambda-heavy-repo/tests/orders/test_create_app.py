# Copyright (C) 2026 Auriora
# SPDX-License-Identifier: GPL-3.0-or-later

from src.orders.create import app


def test_create_handler_returns_response():
    assert app.handler({}, None)["statusCode"] == 201
