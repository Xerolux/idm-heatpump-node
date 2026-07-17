import { spawnSync } from "node:child_process";

export const PACKAGE_COMMAND_TIMEOUT_MS = 120_000;
export const PACKAGE_COMMAND_MAX_OUTPUT_BYTES = 4 * 1024 * 1024;

function requirePositiveInteger(value, field) {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`${field} must be a positive integer`);
  }
}

export function runPackageCommand(command, args, cwd, options = {}) {
  const timeoutMs = options.timeoutMs ?? PACKAGE_COMMAND_TIMEOUT_MS;
  requirePositiveInteger(timeoutMs, "package command timeoutMs");

  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: PACKAGE_COMMAND_MAX_OUTPUT_BYTES,
    shell: false,
    timeout: timeoutMs,
    windowsHide: true,
  });
  const invocation = `${command} ${args.join(" ")}`;

  if (result.error !== undefined) {
    if (result.error.code === "ETIMEDOUT") {
      throw new Error(`Command timed out after ${String(timeoutMs)} ms: ${invocation}`);
    }
    throw new Error(`Command could not run: ${invocation}\n${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(
      `Command failed: ${invocation}\n${result.stdout ?? ""}\n${result.stderr ?? ""}`,
    );
  }
  return result.stdout ?? "";
}
