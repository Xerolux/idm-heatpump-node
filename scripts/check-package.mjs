import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

import { runPackageCommand } from "./package-command.mjs";

const root = process.cwd();
const npmCli = process.env.npm_execpath;

if (npmCli === undefined) {
  throw new Error("npm_execpath is unavailable; run this check through npm run pack:check");
}

const EXPECTED_TARBALL_FILES = Object.freeze(
  [
    "LICENSE",
    "README.md",
    "dist/index.cjs",
    "dist/index.cjs.map",
    "dist/index.d.cts",
    "dist/index.d.ts",
    "dist/index.js",
    "dist/index.js.map",
    "dist/web/index.cjs",
    "dist/web/index.cjs.map",
    "dist/web/index.d.cts",
    "dist/web/index.d.ts",
    "dist/web/index.js",
    "dist/web/index.js.map",
    "package.json",
  ].sort(),
);
const EXPECTED_RUNTIME_DEPENDENCIES = Object.freeze({ "modbus-serial": "8.0.25" });
const PHASE_3_RUNTIME_SYMBOLS = Object.freeze([
  "IdmClientDiagnostics",
  "IdmModbusClient",
  "IllegalAddressError",
  "ModbusErrorContext",
  "quietPymodbusLogging",
  "WriteSafetyResult",
]);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function run(command, args, cwd = root) {
  return runPackageCommand(command, args, cwd);
}

function runNpm(args, cwd = root) {
  return run(process.execPath, [npmCli, ...args], cwd);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function assertExactStringList(actual, expected, description) {
  const actualJson = JSON.stringify([...actual].sort());
  const expectedJson = JSON.stringify([...expected].sort());
  assert(
    actualJson === expectedJson,
    `${description}: expected ${expectedJson}, received ${actualJson}`,
  );
}

function createConsumerProject(parent, name, type, tarballPath) {
  const directory = join(parent, name);
  mkdirSync(directory);
  writeFileSync(
    join(directory, "package.json"),
    `${JSON.stringify({ name, private: true, type }, undefined, 2)}\n`,
  );
  runNpm(["install", "--ignore-scripts", "--no-audit", "--no-fund", tarballPath], directory);
  return directory;
}

function assertInstalledDependency(consumerDirectory) {
  const packageManifest = readJson(
    join(consumerDirectory, "node_modules", "@xerolux", "idm-heatpump", "package.json"),
  );
  assert(
    JSON.stringify(packageManifest.dependencies) === JSON.stringify(EXPECTED_RUNTIME_DEPENDENCIES),
    `Packed runtime dependencies are not exact: ${JSON.stringify(packageManifest.dependencies)}`,
  );

  const providerManifest = readJson(
    join(consumerDirectory, "node_modules", "modbus-serial", "package.json"),
  );
  assert(
    providerManifest.version === EXPECTED_RUNTIME_DEPENDENCIES["modbus-serial"],
    `Installed modbus-serial version is ${String(providerManifest.version)}`,
  );
}

const mapping = readJson(resolve(root, "contracts/api-mapping.json"));
const clientMapping = mapping.mappings.find(
  ({ python_symbol: pythonSymbol }) => pythonSymbol === "IdmModbusClient",
);
assert(clientMapping?.status === "complete", "IdmModbusClient must be complete in Phase 3");
assert(
  clientMapping.partial_class === undefined,
  "Complete client must not retain a partial class",
);
const publicClasses = readJson(resolve(root, "test/fixtures/public-classes.json"));
const clientClass = publicClasses.classes.find(({ python_name: pythonName }) => {
  return pythonName === "IdmModbusClient";
});
assert(clientClass !== undefined, "Pinned IdmModbusClient class facts are missing");
const implementedMembers = clientClass.members.map(({ name }) => {
  return name.replace(/_([a-z0-9])/gu, (_match, character) => character.toUpperCase());
});
assert(implementedMembers.length === 29, "IdmModbusClient must expose exactly 29 members");

const expectedRuntimeExports = mapping.mappings
  .filter(({ export_path: exportPath, status }) => exportPath === "." && status === "complete")
  .map(({ typescript_symbol: typescriptSymbol }) => typescriptSymbol);
const expectedWebRuntimeExports = mapping.mappings
  .filter(({ export_path: exportPath, status }) => exportPath === "./web" && status === "complete")
  .map(({ typescript_symbol: typescriptSymbol }) => typescriptSymbol);
for (const symbol of PHASE_3_RUNTIME_SYMBOLS) {
  assert(
    expectedRuntimeExports.includes(symbol),
    `Missing mapped Phase-3 runtime symbol: ${symbol}`,
  );
}

const dryRunOutput = runNpm(["pack", "--dry-run", "--json", "--ignore-scripts"]);
const packResult = JSON.parse(dryRunOutput)[0];
const files = packResult.files.map(({ path }) => path);
assertExactStringList(files, EXPECTED_TARBALL_FILES, "npm tarball allowlist");

const smokeRoot = mkdtempSync(join(tmpdir(), "idm-heatpump-package-"));
let tarballPath;

try {
  const packOutput = runNpm(["pack", "--json", "--ignore-scripts"]);
  const tarballName = JSON.parse(packOutput)[0].filename;
  tarballPath = resolve(tarballName);

  const esmDirectory = createConsumerProject(smokeRoot, "esm-consumer", "module", tarballPath);
  assertInstalledDependency(esmDirectory);
  writeFileSync(
    join(esmDirectory, "smoke.mjs"),
    `import * as packageRoot from "@xerolux/idm-heatpump";
import * as webRoot from "@xerolux/idm-heatpump/web";
import {
  IdmClientDiagnostics,
  IdmModbusClient,
  IllegalAddressError,
  ModbusErrorContext,
  quietPymodbusLogging,
  WriteSafetyResult,
} from "@xerolux/idm-heatpump";

const expectedExports = ${JSON.stringify(expectedRuntimeExports.sort())};
const expectedWebExports = ${JSON.stringify(expectedWebRuntimeExports.sort())};
const expectedMembers = ${JSON.stringify([...implementedMembers].sort())};
if (JSON.stringify(Object.keys(packageRoot).sort()) !== JSON.stringify(expectedExports)) {
  throw new Error("ESM root export closure failed");
}
if (JSON.stringify(Object.keys(webRoot).sort()) !== JSON.stringify(expectedWebExports)) {
  throw new Error("ESM web export closure failed");
}
const webValue = webRoot.IdmWebValue.create({ name: "flowmeter", value: "1.2", rawKey: "B2", numericValue: 1.2 });
const webData = webRoot.IdmWebData.create({ model: "Navigator 10 Web", values: { flowmeter: webValue } });
if (!Object.isFrozen(webData) || webData.getNumeric("flowmeter") !== 1.2 || !webRoot.webPinConfigured(" 1234 ")) {
  throw new Error("ESM read-only web data smoke failed");
}
if (webRoot.createOptionalNavigator10WebClient("host.invalid", "") !== null || webRoot.createOptionalNavigator20WebClient("host.invalid", "") !== null) {
  throw new Error("ESM optional web factory boundary failed");
}
const client = new IdmModbusClient("heatpump.example.invalid");
if (client.host !== "heatpump.example.invalid" || client.port !== 502) {
  throw new Error("ESM IdmModbusClient defaults failed");
}
if (client.isConnected || client.modelInfo !== null || client.modelName !== "Navigator 2.0") {
  throw new Error("ESM IdmModbusClient initial state failed");
}
const actualMembers = Object.getOwnPropertyNames(IdmModbusClient.prototype)
  .filter((member) => member !== "constructor")
  .sort();
if (JSON.stringify(actualMembers) !== JSON.stringify(expectedMembers)) {
  throw new Error("ESM IdmModbusClient complete member closure failed");
}
const simulation = client.simulateWrite("system_mode", 2);
const result = WriteSafetyResult.create({
  register: simulation.register,
  requestedValue: simulation.requestedValue,
  encodedRegisters: simulation.encodedRegisters,
});
const dryRun = await client.setValue("system_mode", 2, { dryRun: true });
client.resetWriteThrottle();
client.resetCyclicWriteState();
if (!simulation.dryRun || result.dryRun || !dryRun.dryRun || client.isConnected) {
  throw new Error("ESM write planning/dry-run connected or used wrong defaults");
}
if (simulation.encodedRegisters.join(",") !== "2" || dryRun.encodedRegisters.join(",") !== "2") {
  throw new Error("ESM write planning encoded unexpected words");
}
if (Object.keys(client.getActiveCyclicWrites()).length !== 0 || client.getExpiredCyclicWrites().size !== 0) {
  throw new Error("ESM dry-run mutated write state");
}
const diagnostics = IdmClientDiagnostics.create({ navigatorType: client.modelName, modbusConnected: false });
const context = ModbusErrorContext.create({ operation: "read", address: 0, count: 1, registerType: "input", errorType: "timeout", message: "synthetic", attempt: 1 });
const error = new IllegalAddressError("synthetic");
quietPymodbusLogging();
if (!Object.isFrozen(diagnostics) || !Object.isFrozen(context) || error.isIllegalAddress !== true) {
  throw new Error("ESM Phase-3 data/error smoke failed");
}
`,
  );
  run(process.execPath, ["smoke.mjs"], esmDirectory);

  const cjsDirectory = createConsumerProject(smokeRoot, "cjs-consumer", "commonjs", tarballPath);
  assertInstalledDependency(cjsDirectory);
  writeFileSync(
    join(cjsDirectory, "smoke.cjs"),
    `const packageRoot = require("@xerolux/idm-heatpump");
const webRoot = require("@xerolux/idm-heatpump/web");
const {
  IdmClientDiagnostics,
  IdmModbusClient,
  IllegalAddressError,
  ModbusErrorContext,
  quietPymodbusLogging,
  WriteSafetyResult,
} = packageRoot;

async function runSmoke() {
const expectedExports = ${JSON.stringify(expectedRuntimeExports.sort())};
const expectedWebExports = ${JSON.stringify(expectedWebRuntimeExports.sort())};
if (JSON.stringify(Object.keys(packageRoot).sort()) !== JSON.stringify(expectedExports)) {
  throw new Error("CommonJS root export closure failed");
}
if (JSON.stringify(Object.keys(webRoot).sort()) !== JSON.stringify(expectedWebExports)) {
  throw new Error("CommonJS web export closure failed");
}
const webValue = webRoot.IdmWebValue.create({ name: "flowmeter", value: "1.2", rawKey: "B2", numericValue: 1.2 });
const webData = webRoot.IdmWebData.create({ model: "Navigator 10 Web", values: { flowmeter: webValue } });
if (!Object.isFrozen(webData) || webData.getNumeric("flowmeter") !== 1.2 || !webRoot.webPinConfigured(" 1234 ")) {
  throw new Error("CommonJS read-only web data smoke failed");
}
const client = new IdmModbusClient("heatpump.example.invalid");
const diagnostics = IdmClientDiagnostics.create({ navigatorType: client.modelName, modbusConnected: false });
const context = ModbusErrorContext.create({ operation: "read", address: 0, count: 1, registerType: "input", errorType: "timeout", message: "synthetic", attempt: 1 });
const error = new IllegalAddressError("synthetic");
quietPymodbusLogging("WARN");
if (client.host !== "heatpump.example.invalid" || client.port !== 502 || client.isConnected) {
  throw new Error("CommonJS IdmModbusClient defaults failed");
}
if (!Object.isFrozen(diagnostics) || !Object.isFrozen(context) || error.isIllegalAddress !== true) {
  throw new Error("CommonJS Phase-3 data/error smoke failed");
}
const simulation = client.simulateWrite("system_mode", 2);
const result = WriteSafetyResult.create({ register: simulation.register, requestedValue: 2, encodedRegisters: [2] });
const dryRun = await client.setValue("system_mode", 2, { dryRun: true });
client.resetWriteThrottle();
client.resetCyclicWriteState();
if (!simulation.dryRun || result.dryRun || !dryRun.dryRun || client.isConnected) {
  throw new Error("CommonJS write planning/dry-run connected or used wrong defaults");
}
if (dryRun.encodedRegisters.join(",") !== "2") {
  throw new Error("CommonJS dry-run encoded unexpected words");
}
if (Object.keys(client.getActiveCyclicWrites()).length !== 0 || client.getExpiredCyclicWrites().size !== 0) {
  throw new Error("CommonJS planning/dry-run mutated write state");
}
}

runSmoke().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
`,
  );
  run(process.execPath, ["smoke.cjs"], cjsDirectory);

  const typesDirectory = createConsumerProject(smokeRoot, "types-consumer", "module", tarballPath);
  assertInstalledDependency(typesDirectory);
  writeFileSync(
    join(typesDirectory, "consumer.ts"),
    `import {
  IdmClientDiagnostics,
  IdmModbusClient,
  IllegalAddressError,
  ModbusErrorContext,
  quietPymodbusLogging,
  WriteSafetyResult,
  type ModbusTransport,
} from "@xerolux/idm-heatpump";

class StructuralTransport implements ModbusTransport {
  readonly connected = false;
  async connect(): Promise<void> {}
  async close(): Promise<void> {}
  async destroy(): Promise<void> {}
  async read(_request: Parameters<ModbusTransport["read"]>[0]): Promise<readonly number[]> {
    return [];
  }
  async write(_request: Parameters<ModbusTransport["write"]>[0]): Promise<void> {}
}

const transport = new StructuralTransport();
const client = new IdmModbusClient("heatpump.example.invalid");
const diagnostics = IdmClientDiagnostics.create({ navigatorType: client.modelName, modbusConnected: false });
const context = ModbusErrorContext.create({ operation: "read", address: 0, count: 1, registerType: "input", errorType: "timeout", message: "synthetic", attempt: 1 });
const error = new IllegalAddressError("synthetic");
const simulation = client.simulateWrite("system_mode", 2);
const result = WriteSafetyResult.create({
  register: simulation.register,
  requestedValue: simulation.requestedValue,
  encodedRegisters: simulation.encodedRegisters,
});
const dryRun = await client.setValue("system_mode", 2, { dryRun: true });
client.resetWriteThrottle();
client.resetCyclicWriteState();
const active: Readonly<Record<string, number>> = client.getActiveCyclicWrites();
const expired: ReadonlySet<string> = client.getExpiredCyclicWrites();
quietPymodbusLogging();

// @ts-expect-error transport injection is an internal-only seam
new IdmModbusClient("heatpump.example.invalid", { transport });
// @ts-expect-error transport factory injection is an internal-only seam
new IdmModbusClient("heatpump.example.invalid", { transportFactory: () => transport });
// @ts-expect-error clock injection is an internal-only seam
new IdmModbusClient("heatpump.example.invalid", { clock: () => 0 });
// @ts-expect-error sleep injection is an internal-only seam
new IdmModbusClient("heatpump.example.invalid", { sleep: async () => undefined });
// @ts-expect-error adapter retries are fixed internally at zero
new IdmModbusClient("heatpump.example.invalid", { adapterRetries: 0 });
void client.writeRegister;
void [transport, diagnostics, context, error, result, dryRun, active, expired];
`,
  );
  run(
    process.execPath,
    [
      resolve(root, "node_modules/typescript/bin/tsc"),
      "--noEmit",
      "--strict",
      "--target",
      "ES2022",
      "--module",
      "NodeNext",
      "--moduleResolution",
      "NodeNext",
      "consumer.ts",
    ],
    typesDirectory,
  );
} finally {
  rmSync(smokeRoot, { recursive: true, force: true });
  if (tarballPath !== undefined) {
    rmSync(tarballPath, { force: true });
  }
}

console.log(
  `npm package contains ${files.length} exact files; ${basename(tarballPath)} passed ESM, CommonJS, declaration, IdmModbusClient, and ModbusTransport smoke without connecting`,
);
