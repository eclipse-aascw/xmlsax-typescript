// SPDX-FileCopyrightText: 2026 xmlsax-typescript AUTHORS
//
// SPDX-License-Identifier: MIT

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html", "lcov"],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 75,
        statements: 85
      }
    }
  }
});
