import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

const root = process.cwd();
const npmCli = process.env.npm_execpath;

if (npmCli === undefined) {
  throw new Error("npm_execpath is unavailable; run this check through npm run pack:check");
}

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
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

const dryRunOutput = runNpm(["pack", "--dry-run", "--json", "--ignore-scripts"]);
const packResult = JSON.parse(dryRunOutput)[0];
const files = packResult.files.map(({ path }) => path);
const allowedFiles = new Set(["LICENSE", "README.md", "package.json"]);
const unexpectedFiles = files.filter(
  (file) => !allowedFiles.has(file) && !file.startsWith("dist/"),
);

if (unexpectedFiles.length > 0) {
  throw new Error(`Unexpected files in npm package: ${unexpectedFiles.join(", ")}`);
}

const requiredFiles = [
  "dist/index.js",
  "dist/index.cjs",
  "dist/index.d.ts",
  "dist/index.d.cts",
  "dist/web/index.js",
  "dist/web/index.cjs",
  "dist/web/index.d.ts",
  "dist/web/index.d.cts",
];
const missingFiles = requiredFiles.filter((file) => !files.includes(file));

if (missingFiles.length > 0) {
  throw new Error(`Missing files in npm package: ${missingFiles.join(", ")}`);
}

const smokeDirectory = mkdtempSync(join(tmpdir(), "idm-heatpump-package-"));
let tarballPath;

try {
  const packOutput = runNpm(["pack", "--json", "--ignore-scripts"]);
  const tarballName = JSON.parse(packOutput)[0].filename;
  tarballPath = resolve(tarballName);

  writeFileSync(
    join(smokeDirectory, "package.json"),
    `${JSON.stringify({ name: "package-smoke-test", private: true }, undefined, 2)}\n`,
  );
  runNpm(["install", "--ignore-scripts", "--no-audit", "--no-fund", tarballPath], smokeDirectory);
  run(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      'await Promise.all([import("@xerolux/idm-heatpump"), import("@xerolux/idm-heatpump/web")]);',
    ],
    smokeDirectory,
  );
  run(
    process.execPath,
    [
      "--input-type=commonjs",
      "--eval",
      'require("@xerolux/idm-heatpump"); require("@xerolux/idm-heatpump/web");',
    ],
    smokeDirectory,
  );
} finally {
  rmSync(smokeDirectory, { recursive: true, force: true });
  if (tarballPath !== undefined) {
    rmSync(tarballPath, { force: true });
  }
}

console.log(
  `npm package contains ${files.length} intended files; ${basename(tarballPath)} passed ESM and CommonJS smoke tests`,
);
