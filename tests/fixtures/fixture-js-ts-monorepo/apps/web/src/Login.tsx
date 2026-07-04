/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { LoginForm } from "./components/LoginForm";
import { authenticate } from "../../../services/api/src/auth-controller";

export default function Login() {
  return LoginForm({ onSubmit: authenticate });
}
