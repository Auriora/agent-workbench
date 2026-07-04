/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export type LoginFormProps = {
  onSubmit: () => boolean;
};

export function LoginForm(props: LoginFormProps) {
  return props.onSubmit() ? "ok" : "blocked";
}
