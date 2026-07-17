/** Stable semantic validation failures used by cross-language parity contracts. */
export type SemanticValidationErrorCode =
  | "register_invalid"
  | "circuit_invalid"
  | "zone_invalid"
  | "room_invalid"
  | "write_unknown_register"
  | "write_read_only"
  | "write_model_unavailable"
  | "write_boolean_required"
  | "write_boolean_for_numeric"
  | "write_not_numeric"
  | "write_nonfinite"
  | "write_integer_required"
  | "write_excluded"
  | "write_below_minimum"
  | "write_above_maximum"
  | "write_enum_unsupported"
  | "write_eeprom_throttled";

export class SemanticValidationError extends RangeError {
  public readonly category = "validation" as const;
  public readonly code: SemanticValidationErrorCode;
  public readonly diagnostic: string;

  public constructor(code: SemanticValidationErrorCode, diagnostic: string) {
    super(diagnostic);
    this.name = "SemanticValidationError";
    this.code = code;
    this.diagnostic = diagnostic;
  }
}
