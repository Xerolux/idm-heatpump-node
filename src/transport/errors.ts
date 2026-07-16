export const NormalizedTransportFailureKind = Object.freeze({
  TIMEOUT: "timeout",
  DISCONNECTED: "disconnected",
  SOCKET: "socket",
  NO_RESPONSE: "no_response",
  MODBUS: "modbus",
  ILLEGAL_ADDRESS: "illegal_address",
  INVALID_RESPONSE: "invalid_response",
} as const);

export type NormalizedTransportFailureKind =
  (typeof NormalizedTransportFailureKind)[keyof typeof NormalizedTransportFailureKind];

export type RetryableTransportFailureKind = Exclude<
  NormalizedTransportFailureKind,
  typeof NormalizedTransportFailureKind.ILLEGAL_ADDRESS
>;

export interface DiagnosticEndpoint {
  readonly host: string;
  readonly port: number;
}

export const MAX_DIAGNOSTIC_MESSAGE_LENGTH = 1_024;

function codePointLength(value: string): number {
  return [...value].length;
}

function replaceEvery(value: string, token: string, replacement: string): string {
  return value.split(token).join(replacement);
}

export function redactDiagnosticMessage(message: string, endpoint?: DiagnosticEndpoint): string {
  let redacted = message;
  if (endpoint !== undefined) {
    if (endpoint.host.length === 0) {
      throw new RangeError("Diagnostic endpoint host must not be empty");
    }

    const candidates = [
      `${endpoint.host}:${String(endpoint.port)}`,
      `[${endpoint.host}]:${String(endpoint.port)}`,
      endpoint.host,
    ]
      .filter((candidate, index, all) => all.indexOf(candidate) === index)
      .sort((left, right) => codePointLength(right) - codePointLength(left));

    for (const candidate of candidates) {
      redacted = replaceEvery(redacted, candidate, "<endpoint>");
    }
  }

  if (codePointLength(redacted) > MAX_DIAGNOSTIC_MESSAGE_LENGTH) {
    throw new RangeError(
      `Normalized diagnostic exceeds ${String(MAX_DIAGNOSTIC_MESSAGE_LENGTH)} characters`,
    );
  }
  return redacted;
}

export class IllegalAddressError extends Error {
  public readonly isIllegalAddress = true as const;

  public constructor(message: string) {
    super(message);
    this.name = "IllegalAddressError";
    Object.freeze(this);
  }
}

export class NormalizedTransportFailure extends Error {
  public readonly kind: RetryableTransportFailureKind;

  public constructor(kind: RetryableTransportFailureKind, message: string) {
    super(message);
    this.name = "NormalizedTransportFailure";
    this.kind = kind;
    Object.freeze(this);
  }
}

export function createNormalizedTransportFailure(
  kind: RetryableTransportFailureKind,
  message: string,
  endpoint?: DiagnosticEndpoint,
): NormalizedTransportFailure {
  return new NormalizedTransportFailure(kind, redactDiagnosticMessage(message, endpoint));
}

export function createModbusFailure(
  modbusCode: unknown,
  message: string,
  endpoint?: DiagnosticEndpoint,
): IllegalAddressError | NormalizedTransportFailure {
  const normalizedMessage = redactDiagnosticMessage(message, endpoint);
  if (typeof modbusCode === "number" && modbusCode === 2) {
    return new IllegalAddressError(normalizedMessage);
  }
  return new NormalizedTransportFailure(NormalizedTransportFailureKind.MODBUS, normalizedMessage);
}

export function isKnownTransportFailure(
  value: unknown,
): value is IllegalAddressError | NormalizedTransportFailure {
  return value instanceof IllegalAddressError || value instanceof NormalizedTransportFailure;
}
