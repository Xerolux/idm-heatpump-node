/** Stable semantic validation failures used by cross-language parity contracts. */
export class SemanticValidationError extends RangeError {
  public readonly category = "validation" as const;
  public readonly code: "register_invalid";
  public readonly diagnostic: string;

  public constructor(code: "register_invalid", diagnostic: string) {
    super(diagnostic);
    this.name = "SemanticValidationError";
    this.code = code;
    this.diagnostic = diagnostic;
  }
}
