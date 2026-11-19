/**
 * Library-owned Modbus exception hierarchy.
 *
 * Python 2.0.0 replaced the pymodbus-rooted exceptions with an
 * library-owned hierarchy so that consumers injecting their own transport
 * (the documented way to use the library since 1.0) catch no foreign
 * exception types. This module is the TypeScript counterpart: catch
 * {@link IdmModbusError} to handle any Modbus-level failure raised by
 * this library without depending on which Modbus stack performed the I/O.
 */

export class IdmModbusError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "IdmModbusError";
  }
}

/** The transport could not be established, or the link was lost. */
export class IdmConnectionError extends IdmModbusError {
  public constructor(message: string) {
    super(message);
    this.name = "IdmConnectionError";
  }
}

/**
 * A request produced no usable answer.
 *
 * Covers timeouts, short or shifted responses, and replies that answer a
 * different exchange. The session may be stale, so a reconnect is the
 * usual response.
 */
export class IdmTransportError extends IdmModbusError {
  public constructor(message: string) {
    super(message);
    this.name = "IdmTransportError";
  }
}

/**
 * The device answered, and refused the request.
 *
 * `exceptionCode` carries the numeric Modbus exception code when the
 * device supplied one, so consumers can name it without parsing it back
 * out of the message text.
 */
export class IdmDeviceError extends IdmModbusError {
  public readonly exceptionCode: number | null;

  public constructor(message: string, options: { exceptionCode?: number | null } = {}) {
    super(message);
    this.name = "IdmDeviceError";
    this.exceptionCode = options.exceptionCode ?? null;
  }
}

/**
 * Modbus `Illegal Data Address` (exception code 2).
 *
 * Raised when the device reports that a register address does not exist.
 * Unlike a generic device error, this is a permanent condition for the
 * address in question: retrying is pointless and only produces noisy log
 * lines. Callers that detect this marker (via `instanceof` or the
 * `isIllegalAddress` attribute) can short-circuit retries and suppress
 * the repeated "failed after N attempts" warnings that otherwise flood
 * the log when optional registers are probed on devices that do not
 * implement them (e.g. Navigator-10-only blocks read against a
 * Navigator 2.0).
 */
export class IllegalAddressError extends IdmDeviceError {
  /** Sentinel attribute checked by the retry loop to bail out silently. */
  public readonly isIllegalAddress = true;

  public constructor(message: string, options: { exceptionCode?: number | null } = {}) {
    super(message, { exceptionCode: options.exceptionCode ?? 2 });
    this.name = "IllegalAddressError";
  }
}
