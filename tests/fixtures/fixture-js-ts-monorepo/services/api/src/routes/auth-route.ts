/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { AuthController } from "../auth-controller";

export const authRoute = {
  method: "POST",
  path: "/login",
  handler: new AuthController().login
};
