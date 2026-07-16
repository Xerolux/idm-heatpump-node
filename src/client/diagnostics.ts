import type { NormalizedTransportFailureKind } from "../transport/errors.js";

export interface ModbusErrorContextInput {
  readonly operation: string;
  readonly address: number;
  readonly count: number;
  readonly registerType: string;
  readonly errorType: NormalizedTransportFailureKind;
  readonly message: string;
  readonly attempt: number;
}

export interface ModbusErrorContext {
  readonly operation: string;
  readonly address: number;
  readonly count: number;
  readonly registerType: string;
  readonly errorType: NormalizedTransportFailureKind;
  readonly message: string;
  readonly attempt: number;
}

export const ModbusErrorContext = Object.freeze({
  create(input: ModbusErrorContextInput): ModbusErrorContext {
    return Object.freeze({
      operation: input.operation,
      address: input.address,
      count: input.count,
      registerType: input.registerType,
      errorType: input.errorType,
      message: input.message,
      attempt: input.attempt,
    });
  },
});

export interface IdmClientDiagnosticsInput {
  readonly navigatorType: string;
  readonly modbusConnected: boolean;
  readonly firmware?: string | null;
  readonly lastError?: string | null;
  readonly permanentlyFailedRegisters?: readonly string[];
  readonly connectionSuspect?: boolean;
  readonly batchUnsafeRegisters?: readonly string[];
}

export interface IdmClientDiagnostics {
  readonly navigatorType: string;
  readonly modbusConnected: boolean;
  readonly firmware: string | null;
  readonly lastError: string | null;
  readonly permanentlyFailedRegisters: readonly string[];
  readonly connectionSuspect: boolean;
  readonly batchUnsafeRegisters: readonly string[];
}

export const IdmClientDiagnostics = Object.freeze({
  create(input: IdmClientDiagnosticsInput): IdmClientDiagnostics {
    const permanentlyFailedRegisters = Object.freeze([
      ...(input.permanentlyFailedRegisters ?? []),
    ]);
    const batchUnsafeRegisters = Object.freeze([...(input.batchUnsafeRegisters ?? [])]);

    return Object.freeze({
      navigatorType: input.navigatorType,
      modbusConnected: input.modbusConnected,
      firmware: input.firmware ?? null,
      lastError: input.lastError ?? null,
      permanentlyFailedRegisters,
      connectionSuspect: input.connectionSuspect ?? false,
      batchUnsafeRegisters,
    });
  },
});
