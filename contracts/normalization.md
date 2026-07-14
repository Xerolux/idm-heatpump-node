# Cross-language contract normalization

This document is the closed normalization contract between pinned Python
`idm-heatpump-api` behavior and the native TypeScript implementation. Anything
not listed here is a semantic difference and must fail parity verification.

## Approved value normalizations

| Python value             | Contract JSON                                    | TypeScript value              |
| ------------------------ | ------------------------------------------------ | ----------------------------- |
| `None`                   | `null`                                           | `null`                        |
| tuple                    | array in original order                          | `readonly` array              |
| list                     | array in original order                          | `readonly` array              |
| set/frozenset            | array sorted by canonical JSON value             | immutable set-like collection |
| enum member              | the recursively normalized enum value            | frozen `as const` value       |
| mapping                  | object with string keys sorted lexicographically | readonly record/map boundary  |
| `snake_case` public name | documented mapping entry only                    | `camelCase` public name       |

Mapping keys that are Python integers are converted to their decimal strings.
Other non-string mapping keys are rejected. A conversion that creates duplicate
string keys is rejected. Array order is semantic and is never sorted.

## Exceptional numbers

JSON cannot losslessly carry all IEEE-754 states. Exactly four one-key envelopes
are reserved:

```json
{ "$number": "NaN" }
{ "$number": "+Infinity" }
{ "$number": "-Infinity" }
{ "$number": "-0" }
```

No other tag is valid. An object containing `$number` and any additional key is
invalid. Raw non-finite JSON numbers are invalid. Finite numbers, including
ordinary positive zero, remain JSON numbers. No exceptional value may be
converted to `null`.

## Semantic validation errors

Parity compares `{ "category": "validation", "code": ... }`. A bounded
human-readable `diagnostic` may be recorded for debugging but is never used to
make two errors equivalent. Python exception types and messages are not part of
the semantic comparison.

The finite validation code set is:

| Domain            | Codes                                                                                                                                                                                                                                                                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| baseline manifest | `manifest_invalid_json`, `manifest_invalid_shape`, `manifest_unknown_field`, `manifest_missing_field`, `manifest_invalid_schema`, `manifest_invalid_repository`, `manifest_invalid_package`, `manifest_invalid_version`, `manifest_invalid_tag`, `manifest_invalid_commit`, `manifest_invalid_status`, `manifest_invalid_date`, `manifest_identity_mismatch` |
| verified checkout | `invalid_checkout`, `origin_mismatch`, `dirty_checkout`, `branch_checkout`, `head_mismatch`, `tag_mismatch`, `package_mismatch`, `version_mismatch`, `invalid_output_root`                                                                                                                                                                                   |
| register builders | `circuit_invalid`, `zone_invalid`, `room_invalid`, `register_invalid`                                                                                                                                                                                                                                                                                        |
| codec input       | `codec_input_empty`, `codec_input_short`, `codec_word_range`, `codec_not_numeric`, `codec_nonfinite`                                                                                                                                                                                                                                                         |
| codec range       | `codec_float_overflow`, `codec_uchar_range`, `codec_int8_range`, `codec_int16_range`, `codec_uint16_range`                                                                                                                                                                                                                                                   |
| contract schema   | `invalid_number_tag`, `invalid_contract_value`, `scenario_invalid`, `fixture_invalid`                                                                                                                                                                                                                                                                        |

New codes require a reviewed update to this document and focused Python and
TypeScript evidence. Implementations must not collapse undocumented exceptions
into a permissive catch-all equivalence.

## Explicitly forbidden normalizations

- Exception class/name/message matching as semantic evidence.
- Case folding, whitespace folding, numeric-string coercion, truthiness
  coercion, or implicit unit conversion.
- Sorting semantic sequences such as Python `__all__`, request traces, clock
  events, constructor parameters, or member parameters.
- Treating missing fields as `null` or empty collections.
- Additional `$number` tags or mixed reserved-tag objects.
- Navigator 1.0/1.7 data, credentials, PINs, private addresses, device
  identifiers, or raw hardware captures.
