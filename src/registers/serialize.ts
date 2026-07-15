import { normalizeTaggedValue, type NormalizedContractValue } from "../contracts/tagged-values.js";
import { compareUnicodeCodePoints } from "../contracts/canonical-order.js";
import type { RegisterDef } from "./definitions.js";

export interface SerializedRegister {
  readonly address: NormalizedContractValue;
  readonly datatype: NormalizedContractValue;
  readonly name: NormalizedContractValue;
  readonly unit: NormalizedContractValue;
  readonly writable: NormalizedContractValue;
  readonly min_val: NormalizedContractValue;
  readonly max_val: NormalizedContractValue;
  readonly enum_options: NormalizedContractValue;
  readonly multiplier: NormalizedContractValue;
  readonly register_type: NormalizedContractValue;
  readonly eeprom_sensitive: NormalizedContractValue;
  readonly cyclic_required: NormalizedContractValue;
  readonly cyclic_write_ttl: NormalizedContractValue;
  readonly binary: NormalizedContractValue;
  readonly enabled_by_default: NormalizedContractValue;
  readonly state_class: NormalizedContractValue;
  readonly icon: NormalizedContractValue;
  readonly write_only: NormalizedContractValue;
  readonly write_class: NormalizedContractValue;
  readonly exclude_from_write: NormalizedContractValue;
  readonly source: NormalizedContractValue;
  readonly source_version: NormalizedContractValue;
  readonly supported_models: NormalizedContractValue;
  readonly sentinel_values: NormalizedContractValue;
  readonly last_verified: NormalizedContractValue;
  readonly size: NormalizedContractValue;
}

export type SerializedRegisterMap = Readonly<Record<string, SerializedRegister>>;

export function serializeRegisterDef(register: RegisterDef): SerializedRegister {
  const enumOptions = Object.fromEntries(
    Object.entries(register.enumOptions ?? {}).sort(
      ([left], [right]) => Number(left) - Number(right),
    ),
  );
  return Object.freeze({
    address: normalizeTaggedValue(register.address),
    datatype: normalizeTaggedValue(register.datatype),
    name: normalizeTaggedValue(register.name),
    unit: normalizeTaggedValue(register.unit),
    writable: normalizeTaggedValue(register.writable),
    min_val: normalizeTaggedValue(register.minVal),
    max_val: normalizeTaggedValue(register.maxVal),
    enum_options: normalizeTaggedValue(enumOptions),
    multiplier: normalizeTaggedValue(register.multiplier),
    register_type: normalizeTaggedValue(register.registerType),
    eeprom_sensitive: normalizeTaggedValue(register.eepromSensitive),
    cyclic_required: normalizeTaggedValue(register.cyclicRequired),
    cyclic_write_ttl: normalizeTaggedValue(register.cyclicWriteTtl),
    binary: normalizeTaggedValue(register.binary),
    enabled_by_default: normalizeTaggedValue(register.enabledByDefault),
    state_class: normalizeTaggedValue(register.stateClass),
    icon: normalizeTaggedValue(register.icon),
    write_only: normalizeTaggedValue(register.writeOnly),
    write_class: normalizeTaggedValue(register.writeClass),
    exclude_from_write: normalizeTaggedValue(
      [...(register.excludeFromWrite ?? [])].sort((left, right) => left - right),
    ),
    source: normalizeTaggedValue(register.source),
    source_version: normalizeTaggedValue(register.sourceVersion),
    supported_models: normalizeTaggedValue([...register.supportedModels]),
    sentinel_values: normalizeTaggedValue([...register.sentinelValues]),
    last_verified: normalizeTaggedValue(register.lastVerified),
    size: normalizeTaggedValue(register.size),
  });
}

export function serializeRegisterMap(
  registers: ReadonlyMap<string, RegisterDef>,
): SerializedRegisterMap {
  const serialized: Record<string, SerializedRegister> = {};
  for (const [name, register] of [...registers].sort(([left], [right]) =>
    compareUnicodeCodePoints(left, right),
  )) {
    serialized[name] = serializeRegisterDef(register);
  }
  return Object.freeze(serialized);
}
