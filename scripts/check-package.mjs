import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

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
const PHASE_2_RUNTIME_SYMBOLS = Object.freeze([
  "IdmClientDiagnostics",
  "IdmModbusClient",
  "IllegalAddressError",
  "ModbusErrorContext",
  "quietPymodbusLogging",
]);
const OMITTED_WRITE_MEMBERS = Object.freeze([
  "getActiveCyclicWrites",
  "getExpiredCyclicWrites",
  "resetCyclicWriteState",
  "resetWriteThrottle",
  "setValue",
  "simulateWrite",
  "writeRegister",
]);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
    shell: false,
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(
      `Command failed: ${command} ${args.join(" ")}\n${result.error?.message ?? ""}\n${result.stdout ?? ""}\n${result.stderr ?? ""}`,
    );
  }
  return result.stdout;
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
assert(clientMapping?.status === "partial", "IdmModbusClient must remain partial in Phase 2");
const implementedMembers = clientMapping.partial_class?.implemented_members ?? [];
const omittedMembers = clientMapping.partial_class?.omitted_members ?? [];
assertExactStringList(omittedMembers, OMITTED_WRITE_MEMBERS, "Omitted Phase-3 write members");

const expectedRuntimeExports = mapping.mappings
  .filter(
    ({ export_path: exportPath, python_symbol: pythonSymbol, status }) =>
      exportPath === "." &&
      (status === "complete" || (pythonSymbol === "IdmModbusClient" && status === "partial")),
  )
  .map(({ typescript_symbol: typescriptSymbol }) => typescriptSymbol);
for (const symbol of PHASE_2_RUNTIME_SYMBOLS) {
  assert(
    expectedRuntimeExports.includes(symbol),
    `Missing mapped Phase-2 runtime symbol: ${symbol}`,
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
} from "@xerolux/idm-heatpump";

const expectedExports = ${JSON.stringify(expectedRuntimeExports.sort())};
const expectedMembers = ${JSON.stringify([...implementedMembers].sort())};
const omittedMembers = ${JSON.stringify([...omittedMembers].sort())};
if (JSON.stringify(Object.keys(packageRoot).sort()) !== JSON.stringify(expectedExports)) {
  throw new Error("ESM root export closure failed");
}
if (Object.keys(webRoot).length !== 0) throw new Error("Phase-2 web root must remain empty");
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
  throw new Error("ESM IdmModbusClient partial member closure failed");
}
if (omittedMembers.some((member) => member in client)) {
  throw new Error("ESM IdmModbusClient leaked a Phase-3 write member");
}
const diagnostics = IdmClientDiagnostics.create({ navigatorType: client.modelName, modbusConnected: false });
const context = ModbusErrorContext.create({ operation: "read", address: 0, count: 1, registerType: "input", errorType: "timeout", message: "synthetic", attempt: 1 });
const error = new IllegalAddressError("synthetic");
quietPymodbusLogging();
if (!Object.isFrozen(diagnostics) || !Object.isFrozen(context) || error.isIllegalAddress !== true) {
  throw new Error("ESM Phase-2 data/error smoke failed");
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
} = packageRoot;

const expectedExports = ${JSON.stringify(expectedRuntimeExports.sort())};
if (JSON.stringify(Object.keys(packageRoot).sort()) !== JSON.stringify(expectedExports)) {
  throw new Error("CommonJS root export closure failed");
}
if (Object.keys(webRoot).length !== 0) throw new Error("Phase-2 web root must remain empty");
const client = new IdmModbusClient("heatpump.example.invalid");
const diagnostics = IdmClientDiagnostics.create({ navigatorType: client.modelName, modbusConnected: false });
const context = ModbusErrorContext.create({ operation: "read", address: 0, count: 1, registerType: "input", errorType: "timeout", message: "synthetic", attempt: 1 });
const error = new IllegalAddressError("synthetic");
quietPymodbusLogging("WARN");
if (client.host !== "heatpump.example.invalid" || client.port !== 502 || client.isConnected) {
  throw new Error("CommonJS IdmModbusClient defaults failed");
}
if (!Object.isFrozen(diagnostics) || !Object.isFrozen(context) || error.isIllegalAddress !== true) {
  throw new Error("CommonJS Phase-2 data/error smoke failed");
}
for (const member of ${JSON.stringify([...omittedMembers].sort())}) {
  if (member in client) throw new Error("CommonJS client leaked a Phase-3 write member");
}
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
}

const transport = new StructuralTransport();
const client = new IdmModbusClient("heatpump.example.invalid");
const diagnostics = IdmClientDiagnostics.create({ navigatorType: client.modelName, modbusConnected: false });
const context = ModbusErrorContext.create({ operation: "read", address: 0, count: 1, registerType: "input", errorType: "timeout", message: "synthetic", attempt: 1 });
const error = new IllegalAddressError("synthetic");
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
// @ts-expect-error Phase 3 owns getActiveCyclicWrites
void client.getActiveCyclicWrites;
// @ts-expect-error Phase 3 owns getExpiredCyclicWrites
void client.getExpiredCyclicWrites;
// @ts-expect-error Phase 3 owns resetCyclicWriteState
void client.resetCyclicWriteState;
// @ts-expect-error Phase 3 owns resetWriteThrottle
void client.resetWriteThrottle;
// @ts-expect-error Phase 3 owns setValue
void client.setValue;
// @ts-expect-error Phase 3 owns simulateWrite
void client.simulateWrite;
// @ts-expect-error Phase 3 owns writeRegister
void client.writeRegister;

void [transport, diagnostics, context, error];
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
