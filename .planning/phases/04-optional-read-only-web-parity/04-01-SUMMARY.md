# Phase 4 Summary

Completed the optional read-only `@xerolux/idm-heatpump/web` entry point for
Navigator 10 WebSocket and Navigator 2.0 HTTP. The implementation covers the
30 mapped web exports, login/PIN/CSRF handling, parsing, cache, notifications,
statistics, capabilities, diagnostics, error normalization, ESM/CommonJS
package smoke, and Python-generated web contracts.

The Modbus package root remains independent, missing PINs preserve Modbus-only
operation, and no web write API, browser-support claim, or telemetry was added.
