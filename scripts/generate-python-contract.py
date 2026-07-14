#!/usr/bin/env python3
"""Generate deterministic semantic contracts from the exact pinned Python release.

The checkout is treated as executable input. Repository identity, cleanliness,
detached HEAD, tag target, package metadata, and schema are verified before the
checkout is added to ``sys.path`` or any upstream module is imported.
"""

from __future__ import annotations

import argparse
import enum
import json
import math
import os
import re
import subprocess
import sys
import tempfile
import tomllib
from collections.abc import Mapping, Sequence, Set
from pathlib import Path
from typing import Any, NoReturn

GENERATOR_VERSION = "1"
SUPPORTED_SCHEMA = 1
EXPECTED_BASELINE = {
    "schema_version": 1,
    "repository": "https://github.com/Xerolux/idm-heatpump-api",
    "python_package": "idm-heatpump-api",
    "python_version": "0.7.6",
    "git_tag": "v0.7.6",
    "git_commit": "ad121ebf34a5f5e37204371c026927d77efcd15c",
}
EXPECTED_MANIFEST_FIELDS = {
    "schema_version",
    "repository",
    "python_package",
    "python_version",
    "git_tag",
    "git_commit",
    "parity_status",
    "verified_on",
}
PARITY_STATUSES = {"planned", "partial", "complete"}
NUMBER_TAGS = {"NaN", "+Infinity", "-Infinity", "-0"}
MAX_MANIFEST_BYTES = 64 * 1024
MAX_PROCESS_OUTPUT = 64 * 1024
PROCESS_TIMEOUT_SECONDS = 10
OUTPUT_PATHS = (
    Path("test/fixtures/public-api.json"),
    Path("test/fixtures/public-classes.json"),
    Path("test/fixtures/codec-vectors.json"),
    Path("test/fixtures/register-schema.json"),
    Path("test/fixtures/behavior-contract.json"),
    Path("test/fixtures/web-contract.json"),
)


class ContractError(Exception):
    """Closed generator failure carrying a stable semantic code."""

    def __init__(self, code: str, diagnostic: str) -> None:
        super().__init__(f"{code}: {diagnostic}")
        self.code = code


def fail(code: str, diagnostic: str) -> NoReturn:
    raise ContractError(code, diagnostic[:MAX_PROCESS_OUTPUT])


def _sort_key(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, allow_nan=False, sort_keys=True, separators=(",", ":"))


def normalize_contract_value(value: Any) -> Any:
    """Normalize only the language differences approved by the contract."""
    if value is None or isinstance(value, (str, bool, int)):
        return value
    if isinstance(value, float):
        if math.isnan(value):
            return {"$number": "NaN"}
        if math.isinf(value):
            return {"$number": "+Infinity" if value > 0 else "-Infinity"}
        if value == 0.0 and math.copysign(1.0, value) < 0:
            return {"$number": "-0"}
        return value
    if isinstance(value, enum.Enum):
        return normalize_contract_value(value.value)
    if isinstance(value, Mapping):
        if "$number" in value:
            if len(value) != 1 or value.get("$number") not in NUMBER_TAGS:
                fail("invalid_number_tag", "reserved $number envelopes have one closed tag")
            return {"$number": value["$number"]}
        normalized: dict[str, Any] = {}
        for key, item in value.items():
            if isinstance(key, str):
                normalized_key = key
            elif isinstance(key, int) and not isinstance(key, bool):
                normalized_key = str(key)
            else:
                fail("invalid_contract_value", "mapping keys must be strings or integers")
            if normalized_key in normalized:
                fail("invalid_contract_value", f"duplicate normalized mapping key: {normalized_key}")
            normalized[normalized_key] = normalize_contract_value(item)
        return {key: normalized[key] for key in sorted(normalized)}
    if isinstance(value, Set) and not isinstance(value, (str, bytes, bytearray)):
        items = [normalize_contract_value(item) for item in value]
        return sorted(items, key=_sort_key)
    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        return [normalize_contract_value(item) for item in value]
    fail("invalid_contract_value", f"unsupported contract value type: {type(value).__name__}")


def validate_contract_value(value: Any) -> None:
    """Reject ambiguous or lossy values in an already-normalized contract."""
    if value is None or isinstance(value, (str, bool, int)):
        return
    if isinstance(value, float):
        if not math.isfinite(value) or (value == 0.0 and math.copysign(1.0, value) < 0):
            fail("invalid_number_tag", "exceptional numbers must use the reserved envelope")
        return
    if isinstance(value, list):
        for item in value:
            validate_contract_value(item)
        return
    if isinstance(value, dict):
        if "$number" in value:
            if len(value) != 1 or value.get("$number") not in NUMBER_TAGS:
                fail("invalid_number_tag", "reserved $number envelopes have one closed tag")
            return
        for key, item in value.items():
            if not isinstance(key, str):
                fail("invalid_contract_value", "normalized mapping keys must be strings")
            validate_contract_value(item)
        return
    fail("invalid_contract_value", f"unsupported normalized type: {type(value).__name__}")


def canonical_json_bytes(value: Any) -> bytes:
    normalized = normalize_contract_value(value)
    validate_contract_value(normalized)
    return (
        json.dumps(
            normalized,
            ensure_ascii=False,
            allow_nan=False,
            sort_keys=True,
            indent=2,
        )
        + "\n"
    ).encode("utf-8")


def _run_git(checkout: Path, arguments: list[str], purpose: str, statuses: set[int] | None = None) -> tuple[int, str]:
    accepted = {0} if statuses is None else statuses
    try:
        result = subprocess.run(
            ["git", *arguments],
            cwd=checkout,
            check=False,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            shell=False,
            timeout=PROCESS_TIMEOUT_SECONDS,
        )
    except (OSError, subprocess.SubprocessError) as error:
        fail("invalid_checkout", f"{purpose} failed: {error}")
    if result.returncode not in accepted:
        diagnostic = (result.stderr or result.stdout).strip()
        fail("invalid_checkout", f"{purpose} failed: {diagnostic}")
    output = result.stdout
    if len(output.encode("utf-8")) > MAX_PROCESS_OUTPUT:
        fail("invalid_checkout", f"{purpose} produced excessive output")
    return result.returncode, output.strip()


def _read_manifest(path: Path) -> dict[str, Any]:
    try:
        canonical = path.resolve(strict=True)
        if not canonical.is_file() or canonical.stat().st_size > MAX_MANIFEST_BYTES:
            fail("manifest_invalid_shape", "manifest must be a bounded regular file")
        value = json.loads(canonical.read_text(encoding="utf-8"))
    except ContractError:
        raise
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        fail("manifest_invalid_json", str(error))
    if not isinstance(value, dict):
        fail("manifest_invalid_shape", "manifest root must be an object")
    unknown = set(value) - EXPECTED_MANIFEST_FIELDS
    missing = EXPECTED_MANIFEST_FIELDS - set(value)
    if unknown:
        fail("manifest_unknown_field", f"unknown field: {sorted(unknown)[0]}")
    if missing:
        fail("manifest_missing_field", f"missing field: {sorted(missing)[0]}")
    if value.get("schema_version") != SUPPORTED_SCHEMA:
        fail("manifest_invalid_schema", "unsupported parity schema")
    for key in ("repository", "python_package", "python_version", "git_tag", "git_commit"):
        if value.get(key) != EXPECTED_BASELINE[key]:
            fail(f"manifest_invalid_{'repository' if key == 'repository' else key.removeprefix('python_').removeprefix('git_')}", f"unexpected {key}")
    version = value.get("python_version")
    if value.get("git_tag") != f"v{version}":
        fail("manifest_invalid_tag", "tag must equal v<python_version>")
    if not isinstance(value.get("git_commit"), str) or re.fullmatch(r"[0-9a-f]{40}", value["git_commit"]) is None:
        fail("manifest_invalid_commit", "commit must be a full lowercase SHA")
    if value.get("parity_status") not in PARITY_STATUSES:
        fail("manifest_invalid_status", "unsupported parity status")
    if not isinstance(value.get("verified_on"), str) or re.fullmatch(r"\d{4}-\d{2}-\d{2}", value["verified_on"]) is None:
        fail("manifest_invalid_date", "verified_on must be YYYY-MM-DD")
    return value


def _parse_project_metadata(text: str) -> tuple[str, str]:
    try:
        project = tomllib.loads(text)["project"]
        name = project["name"]
        version = project["version"]
    except (tomllib.TOMLDecodeError, KeyError, TypeError) as error:
        fail("package_mismatch", f"invalid pinned pyproject.toml: {error}")
    if not isinstance(name, str) or not isinstance(version, str):
        fail("package_mismatch", "pinned package name/version must be strings")
    return name, version


def verify_checkout(manifest: Mapping[str, Any], upstream_directory: Path) -> Path:
    try:
        checkout = upstream_directory.resolve(strict=True)
    except OSError as error:
        fail("invalid_checkout", str(error))
    if not checkout.is_dir():
        fail("invalid_checkout", "upstream path must be a directory")
    _, inside = _run_git(checkout, ["rev-parse", "--is-inside-work-tree"], "worktree check")
    if inside != "true":
        fail("invalid_checkout", "upstream path is not a Git worktree")
    _, top = _run_git(checkout, ["rev-parse", "--show-toplevel"], "top-level check")
    try:
        if Path(top).resolve(strict=True) != checkout:
            fail("invalid_checkout", "upstream path must be the checkout root")
    except OSError as error:
        fail("invalid_checkout", str(error))
    _, origins_text = _run_git(checkout, ["remote", "get-url", "--all", "origin"], "origin check")
    origins = origins_text.splitlines()
    if origins != [manifest["repository"]]:
        fail("origin_mismatch", "origin must exactly match the allowlisted repository")
    _, status = _run_git(checkout, ["status", "--porcelain=v1", "--untracked-files=normal"], "cleanliness check")
    if status:
        fail("dirty_checkout", "upstream checkout must be clean")
    symbolic_status, _ = _run_git(checkout, ["symbolic-ref", "--quiet", "HEAD"], "detached HEAD check", {0, 1})
    if symbolic_status == 0:
        fail("branch_checkout", "upstream checkout must use detached HEAD")
    _, head = _run_git(checkout, ["rev-parse", "--verify", "HEAD^{commit}"], "HEAD check")
    if head != manifest["git_commit"]:
        fail("head_mismatch", "HEAD does not match the pinned commit")
    _, tag_target = _run_git(checkout, ["rev-parse", "--verify", f"{manifest['git_tag']}^{{commit}}"], "tag check")
    if tag_target != manifest["git_commit"]:
        fail("tag_mismatch", "tag does not resolve to the pinned commit")
    _, pyproject = _run_git(checkout, ["show", f"{manifest['git_commit']}:pyproject.toml"], "pyproject check")
    package, version = _parse_project_metadata(pyproject)
    if package != manifest["python_package"]:
        fail("package_mismatch", "pinned package name does not match")
    if version != manifest["python_version"]:
        fail("version_mismatch", "pinned package version does not match")
    return checkout


def _is_caller_temporary_root(path: Path) -> bool:
    temporary = Path(tempfile.gettempdir()).resolve()
    try:
        relative = path.relative_to(temporary)
    except ValueError:
        return False
    return bool(relative.parts) and relative.parts[0].startswith(("idm-python-contract-", "idm-heatpump-contract-"))


def validate_output_root(raw_path: str | None, repository_root: Path) -> Path:
    if raw_path is None:
        return repository_root
    try:
        output = Path(raw_path).resolve(strict=True)
    except OSError as error:
        fail("invalid_output_root", str(error))
    if not output.is_dir() or not _is_caller_temporary_root(output):
        fail("invalid_output_root", "output root must be a caller-owned contract temporary directory")
    return output


def parse_arguments(arguments: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--upstream-dir", required=True)
    parser.add_argument("--output-root")
    parser.add_argument("--check", action="store_true")
    return parser.parse_args(arguments)


def main(arguments: list[str] | None = None) -> int:
    if sys.version_info < (3, 12):
        fail("invalid_checkout", "Python 3.12 or newer is required")
    args = parse_arguments(sys.argv[1:] if arguments is None else arguments)
    repository_root = Path(__file__).resolve().parents[1]
    manifest = _read_manifest(Path(args.manifest))
    checkout = verify_checkout(manifest, Path(args.upstream_dir))
    output_root = validate_output_root(args.output_root, repository_root)

    # The import boundary deliberately remains below every admission check.
    # Fixture extraction is added by the next task.
    del checkout, output_root
    fail("fixture_invalid", "semantic fixture extraction is not implemented")


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ContractError as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(1) from None
