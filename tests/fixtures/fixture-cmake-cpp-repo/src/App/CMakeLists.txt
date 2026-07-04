# Copyright (C) 2026 Auriora
# SPDX-License-Identifier: GPL-3.0-or-later

add_library(App DocumentObject.cpp ExecutionController.cpp)
add_executable(AppTests DocumentObjectTest.cpp)
