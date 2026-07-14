export interface UpstreamParity {
  readonly schema_version: number;
  readonly repository: string;
  readonly python_package: string;
  readonly python_version: string;
  readonly git_tag: string;
  readonly git_commit: string;
  readonly parity_status: string;
}

export interface CompatibilityMatrix {
  readonly schema_version: number;
  readonly development_baseline: {
    readonly python_version: string;
    readonly python_commit: string;
    readonly status: string;
  };
  readonly releases: readonly unknown[];
}

export function assertParityMetadataConsistency(
  upstream: UpstreamParity,
  matrix: CompatibilityMatrix,
): void {
  if (!/^[0-9a-f]{40}$/u.test(upstream.git_commit)) {
    throw new Error("Upstream parity must pin a full lowercase Git commit SHA");
  }
  if (upstream.git_tag !== `v${upstream.python_version}`) {
    throw new Error("Upstream Python tag and version do not match");
  }
  if (matrix.schema_version !== upstream.schema_version) {
    throw new Error("Parity schema versions do not match");
  }
  if (matrix.development_baseline.python_version !== upstream.python_version) {
    throw new Error("Development baseline Python versions do not match");
  }
  if (matrix.development_baseline.python_commit !== upstream.git_commit) {
    throw new Error("Development baseline Python commits do not match");
  }
  if (matrix.development_baseline.status !== upstream.parity_status) {
    throw new Error("Development baseline parity statuses do not match");
  }
}
