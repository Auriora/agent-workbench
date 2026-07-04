/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

#include "DocumentObject.h"

namespace {
bool shouldRecompute(const DocumentObject& object) {
    return object.mustExecute();
}
}

int runExecution(DocumentObject& object) {
    if (shouldRecompute(object)) {
        object.recompute();
        return 1;
    }
    return 0;
}
