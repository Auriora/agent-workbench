/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

#include "DocumentObject.h"

int main() {
    DocumentObject object;
    object.recompute();
    return object.mustExecute() ? 0 : 1;
}
