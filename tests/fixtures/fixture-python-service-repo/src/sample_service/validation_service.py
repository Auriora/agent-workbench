# Copyright (C) 2026 Auriora
# SPDX-License-Identifier: GPL-3.0-or-later

class ValidationService:
    def validate_uri(self, value: str) -> bool:
        return value.startswith("repo:///")

