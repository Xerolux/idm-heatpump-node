const PYTHON_LOGGING_LEVELS = Object.freeze({
  CRITICAL: 50,
  FATAL: 50,
  ERROR: 40,
  WARNING: 30,
  WARN: 30,
  INFO: 20,
  DEBUG: 10,
  NOTSET: 0,
} as const);

export type PymodbusLoggingHook = (level: number) => void;

let pymodbusLoggingHook: PymodbusLoggingHook | undefined;

function parsePythonLoggingLevel(level: string | number): number {
  if (typeof level === "number") {
    if (!Number.isInteger(level)) {
      throw new TypeError("Log level must be an integer");
    }
    return level;
  }

  const numeric =
    PYTHON_LOGGING_LEVELS[level.toUpperCase() as keyof typeof PYTHON_LOGGING_LEVELS];
  if (numeric === undefined) {
    throw new RangeError(`Unknown log level: ${level}`);
  }
  return numeric;
}

export function registerPymodbusLoggingHook(hook: PymodbusLoggingHook): () => void {
  if (typeof hook !== "function") {
    throw new TypeError("Pymodbus logging hook must be a function");
  }

  const previous = pymodbusLoggingHook;
  pymodbusLoggingHook = hook;
  let registered = true;

  return (): void => {
    if (registered && pymodbusLoggingHook === hook) {
      pymodbusLoggingHook = previous;
    }
    registered = false;
  };
}

export function quietPymodbusLogging(level: string | number = "WARNING"): void {
  const numeric = parsePythonLoggingLevel(level);
  pymodbusLoggingHook?.(numeric);
}
