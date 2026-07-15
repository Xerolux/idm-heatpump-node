/** Stable semantic validation failures used by cross-language parity contracts. */
export type SemanticValidationErrorCode =
  "register_invalid" | "circuit_invalid" | "zone_invalid" | "room_invalid";

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
