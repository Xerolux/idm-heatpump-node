#!/usr/bin/env python3
"""Generate deterministic semantic contracts from the exact pinned Python release.

The checkout is treated as executable input. Repository identity, cleanliness,
detached HEAD, tag target, package metadata, and schema are verified before the
checkout is added to ``sys.path`` or any upstream module is imported.
"""

from __future__ import annotations

import argparse
import ast
import asyncio
import dataclasses
import enum
import hashlib
import inspect
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
import tomllib
from collections.abc import Iterator, Mapping, Sequence, Set
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
MAX_SAFE_INTEGER = 2**53 - 1
MIN_SAFE_INTEGER = -MAX_SAFE_INTEGER
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
    Path("test/fixtures/transport-behavior.json"),
    Path("test/fixtures/write-behavior.json"),
)


class ContractError(Exception):
    """Closed generator failure carrying a stable semantic code."""

    def __init__(self, code: str, diagnostic: str) -> None:
        super().__init__(f"{code}: {diagnostic}")
        self.code = code


def fail(code: str, diagnostic: str) -> NoReturn:
    raise ContractError(code, diagnostic[:MAX_PROCESS_OUTPUT])


def _validate_python_integer(value: int) -> None:
    if value < MIN_SAFE_INTEGER or value > MAX_SAFE_INTEGER:
        fail("invalid_contract_value", "Python integers must be within the JavaScript safe-integer range")


def _structural_sort_key(value: Any) -> tuple[Any, ...]:
    """Return the closed language-neutral ordering key for normalized values."""
    if value is None:
        return (0,)
    if isinstance(value, bool):
        return (1, value)
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if isinstance(value, int):
            _validate_python_integer(value)
        if isinstance(value, float) and (not math.isfinite(value) or (value == 0.0 and math.copysign(1.0, value) < 0)):
            fail("invalid_number_tag", "exceptional numbers must use the reserved envelope")
        return (2, value)
    if isinstance(value, str):
        return (3, value)
    if isinstance(value, list):
        return (4, tuple(_structural_sort_key(item) for item in value))
    if isinstance(value, dict):
        return (5, tuple((key, _structural_sort_key(value[key])) for key in sorted(value)))
    fail("invalid_contract_value", f"unsupported normalized type: {type(value).__name__}")


def normalize_contract_value(value: Any) -> Any:
    """Normalize only the language differences approved by the contract."""
    if value is None or isinstance(value, (str, bool)):
        return value
    if isinstance(value, int):
        _validate_python_integer(value)
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
                _validate_python_integer(key)
                normalized_key = str(key)
            else:
                fail("invalid_contract_value", "mapping keys must be strings or integers")
            if normalized_key in normalized:
                fail("invalid_contract_value", f"duplicate normalized mapping key: {normalized_key}")
            normalized[normalized_key] = normalize_contract_value(item)
        return {key: normalized[key] for key in sorted(normalized)}
    if isinstance(value, Set) and not isinstance(value, (str, bytes, bytearray)):
        items = [normalize_contract_value(item) for item in value]
        return sorted(items, key=_structural_sort_key)
    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        return [normalize_contract_value(item) for item in value]
    fail("invalid_contract_value", f"unsupported contract value type: {type(value).__name__}")


def validate_contract_value(value: Any) -> None:
    """Reject ambiguous or lossy values in an already-normalized contract."""
    if value is None or isinstance(value, (str, bool)):
        return
    if isinstance(value, int):
        _validate_python_integer(value)
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


def _baseline_provenance(manifest: Mapping[str, Any]) -> dict[str, Any]:
    return {
        "repository": manifest["repository"],
        "python_package": manifest["python_package"],
        "python_version": manifest["python_version"],
        "git_tag": manifest["git_tag"],
        "git_commit": manifest["git_commit"],
        "parity_schema_version": manifest["schema_version"],
    }


def _fixture_root(manifest: Mapping[str, Any], **content: Any) -> dict[str, Any]:
    return {
        "schema_version": 1,
        "generator_version": GENERATOR_VERSION,
        "baseline": _baseline_provenance(manifest),
        **content,
    }


def _source_groups(checkout: Path) -> dict[str, str]:
    source = (checkout / "idm_heatpump" / "__init__.py").read_text(encoding="utf-8")
    tree = ast.parse(source)
    groups: dict[str, str] = {}
    for node in tree.body:
        if not isinstance(node, ast.ImportFrom) or node.level != 1 or node.module is None:
            continue
        for imported in node.names:
            groups[imported.asname or imported.name] = node.module
    return groups


def _signature_value(value: Any) -> dict[str, Any]:
    if value is inspect.Parameter.empty:
        return {"kind": "required"}
    if value is None or isinstance(value, (str, bool, int, float, list, tuple, set, frozenset, dict, enum.Enum)):
        return {"kind": "value", "value": normalize_contract_value(value)}
    if inspect.isroutine(value):
        return {
            "kind": "callable",
            "module": getattr(value, "__module__", None),
            "qualname": getattr(value, "__qualname__", getattr(value, "__name__", type(value).__name__)),
        }
    if inspect.isclass(value):
        return {
            "kind": "type",
            "module": value.__module__,
            "qualname": value.__qualname__,
        }
    return {"kind": "python_literal", "type": type(value).__name__, "text": str(value)}


def _annotation_text(annotation: Any) -> str | None:
    if annotation is inspect.Parameter.empty or annotation is inspect.Signature.empty:
        return None
    if isinstance(annotation, str):
        return annotation
    return inspect.formatannotation(annotation)


def _signature_fact(callable_value: Any, *, drop_first: bool = False) -> dict[str, Any]:
    try:
        signature = inspect.signature(callable_value)
    except (TypeError, ValueError):
        return {"signature": "unavailable", "parameters": [], "return_annotation": None}
    parameters = list(signature.parameters.values())
    if drop_first and parameters and parameters[0].name in {"self", "cls"}:
        parameters = parameters[1:]
    return {
        "signature": str(signature),
        "parameters": [
            {
                "name": parameter.name,
                "kind": parameter.kind.name,
                "default": _signature_value(parameter.default),
                "annotation": _annotation_text(parameter.annotation),
            }
            for parameter in parameters
        ],
        "return_annotation": _annotation_text(signature.return_annotation),
    }


def _class_constructor_fact(class_value: type[Any]) -> dict[str, Any]:
    try:
        inspect.signature(class_value)
    except (TypeError, ValueError):
        fact = _signature_fact(class_value.__init__, drop_first=True)
        return {**fact, "source": "inherited_or_declared_init"}
    return {**_signature_fact(class_value), "source": "class_signature"}


def _class_members(class_value: type[Any]) -> list[dict[str, Any]]:
    members: list[dict[str, Any]] = []
    dataclass_fields = getattr(class_value, "__dataclass_fields__", {})
    for name, dataclass_field in sorted(dataclass_fields.items()):
        if name.startswith("_"):
            continue
        if dataclass_field.default is not dataclasses.MISSING:
            default = _signature_value(dataclass_field.default)
        elif dataclass_field.default_factory is not dataclasses.MISSING:
            factory = dataclass_field.default_factory
            default = {
                "kind": "factory",
                "module": getattr(factory, "__module__", None),
                "qualname": getattr(factory, "__qualname__", getattr(factory, "__name__", type(factory).__name__)),
            }
        else:
            default = {"kind": "required"}
        members.append(
            {
                "name": name,
                "kind": "attribute",
                "annotation": _annotation_text(dataclass_field.type),
                "default": default,
                "init": bool(dataclass_field.init),
            }
        )
    for name in sorted(class_value.__dict__):
        if name.startswith("_"):
            continue
        if name in dataclass_fields:
            continue
        static = inspect.getattr_static(class_value, name)
        if isinstance(static, property):
            members.append(
                {
                    "name": name,
                    "kind": "property",
                    "readable": static.fget is not None,
                    "writable": static.fset is not None,
                    "return_annotation": _annotation_text(
                        inspect.signature(static.fget).return_annotation if static.fget is not None else inspect.Signature.empty
                    ),
                }
            )
            continue
        if isinstance(static, staticmethod):
            members.append({"name": name, "kind": "staticmethod", **_signature_fact(static.__func__)})
            continue
        if isinstance(static, classmethod):
            members.append({"name": name, "kind": "classmethod", **_signature_fact(static.__func__, drop_first=True)})
            continue
        if inspect.isfunction(static) or inspect.ismethoddescriptor(static):
            members.append({"name": name, "kind": "method", **_signature_fact(static, drop_first=True)})
    return members


def _validation_error(code: str, diagnostic: str) -> dict[str, Any]:
    return {"category": "validation", "code": code, "diagnostic": diagnostic[:240]}


def _observe_constructor(class_value: type[Any], arguments: list[Any], keywords: dict[str, Any], code: str) -> dict[str, Any]:
    try:
        class_value(*arguments, **keywords)
    except Exception as error:  # noqa: BLE001 - exact pinned behavior is captured as data
        return {
            "input": normalize_contract_value({"arguments": arguments, "keywords": keywords}),
            "outcome": "rejected",
            "error": _validation_error(code, str(error)),
        }
    return {
        "input": normalize_contract_value({"arguments": arguments, "keywords": keywords}),
        "outcome": "accepted",
    }


def _class_validation_boundaries(class_value: type[Any]) -> list[dict[str, Any]]:
    name = class_value.__name__
    if name == "AdaptiveBackoff":
        return [
            _observe_constructor(class_value, [], {"initial": 5.0, "multiplier": 3.0, "maximum": 300.0}, "register_invalid"),
            _observe_constructor(class_value, [], {"initial": 0.0}, "register_invalid"),
            _observe_constructor(class_value, [], {"multiplier": 0.5}, "register_invalid"),
        ]
    if name == "PollRateLimiter":
        return [
            _observe_constructor(class_value, [0.0], {}, "register_invalid"),
            _observe_constructor(class_value, [-1.0], {}, "register_invalid"),
        ]
    if name == "IdmModbusClient":
        return [
            _observe_constructor(class_value, ["example.invalid"], {}, "register_invalid"),
            _observe_constructor(class_value, [""], {}, "register_invalid"),
            _observe_constructor(class_value, ["example.invalid"], {"port": 0}, "register_invalid"),
            _observe_constructor(class_value, ["example.invalid"], {"slave_id": 248}, "register_invalid"),
        ]
    if name == "RegisterDef":
        client_module = sys.modules[class_value.__module__]
        datatype = client_module.DataType.UCHAR
        return [
            _observe_constructor(class_value, [0, datatype, "boundary"], {}, "register_invalid"),
            _observe_constructor(class_value, [-1, datatype, "boundary"], {}, "register_invalid"),
            _observe_constructor(class_value, [1, datatype, "boundary"], {"multiplier": 0}, "register_invalid"),
        ]
    return [
        {
            "kind": "signature_acceptance_domain",
            "parameters": [parameter["name"] for parameter in _class_constructor_fact(class_value)["parameters"]],
        }
    ]


def _public_fixtures(manifest: Mapping[str, Any], checkout: Path, package: Any) -> tuple[dict[str, Any], dict[str, Any]]:
    groups = _source_groups(checkout)
    public_names = list(package.__all__)
    if len(public_names) != 89 or len(set(public_names)) != 89:
        fail("fixture_invalid", "pinned package must expose exactly 89 unique symbols")
    symbols: list[dict[str, Any]] = []
    aliases: list[dict[str, str]] = []
    classes_by_identity: dict[tuple[str, str], dict[str, Any]] = {}
    for name in public_names:
        if name not in groups or not hasattr(package, name):
            fail("fixture_invalid", f"public symbol is not source-backed/importable: {name}")
        group = groups[name]
        boundary = "./web" if group == "web" else "."
        value = getattr(package, name)
        python_kind = "class" if inspect.isclass(value) else "function" if callable(value) else "constant"
        symbols.append(
            {
                "name": name,
                "source_group": group,
                "export_boundary": boundary,
                "python_kind": python_kind,
            }
        )
        actual_name = getattr(value, "__name__", name)
        if isinstance(actual_name, str) and actual_name != name:
            aliases.append({"name": name, "target": actual_name})
        if inspect.isclass(value):
            identity = (value.__module__, value.__qualname__)
            entry = classes_by_identity.get(identity)
            if entry is None:
                entry = {
                    "python_module": value.__module__,
                    "python_name": value.__qualname__,
                    "source_group": group,
                    "public_names": [],
                    "constructor": _class_constructor_fact(value),
                    "members": _class_members(value),
                    "validation_boundaries": _class_validation_boundaries(value),
                }
                classes_by_identity[identity] = entry
            entry["public_names"].append(name)
    root_count = sum(symbol["export_boundary"] == "." for symbol in symbols)
    web_count = len(symbols) - root_count
    if (root_count, web_count) != (59, 30):
        fail("fixture_invalid", f"unexpected public ownership split: {root_count}/{web_count}")
    public_api = _fixture_root(
        manifest,
        counts={"total": len(symbols), "root": root_count, "web": web_count},
        symbols=symbols,
        aliases=aliases,
    )
    public_classes = _fixture_root(
        manifest,
        classes=list(classes_by_identity.values()),
    )
    forbidden = {"typescript_symbol", "representation", "owner_phase", "export_path", "status", "mapping_evidence"}
    if forbidden.intersection(_recursive_keys(public_classes)):
        fail("fixture_invalid", "public class facts contain Node-only mapping keys")
    return public_api, public_classes


def _recursive_keys(value: Any) -> set[str]:
    keys: set[str] = set()
    if isinstance(value, dict):
        for key, item in value.items():
            keys.add(str(key))
            keys.update(_recursive_keys(item))
    elif isinstance(value, list):
        for item in value:
            keys.update(_recursive_keys(item))
    return keys


def _success_case(identifier: str, operation: str, inputs: Any, callback: Any) -> dict[str, Any]:
    return {
        "id": identifier,
        "operation": operation,
        "input": normalize_contract_value(inputs),
        "expected_result": normalize_contract_value(callback()),
    }


def _error_case(identifier: str, operation: str, inputs: Any, code: str, callback: Any) -> dict[str, Any]:
    try:
        callback()
    except Exception as error:  # noqa: BLE001 - exact rejection is expected fixture data
        return {
            "id": identifier,
            "operation": operation,
            "input": normalize_contract_value(inputs),
            "expected_error": _validation_error(code, str(error)),
        }
    fail("fixture_invalid", f"expected Python rejection did not occur: {identifier}")


def _codec_fixture(manifest: Mapping[str, Any], client_module: Any) -> dict[str, Any]:
    codec = client_module.ModbusCodec
    datatype = client_module.DataType
    register_def = client_module.RegisterDef
    client = client_module.IdmModbusClient("example.invalid")
    primitive: list[dict[str, Any]] = [
        _success_case("primitive_float32_low_word_first", "decode_float32", {"words": [0, 16256], "swapped": False}, lambda: codec.decode_float32([0, 16256])),
        _success_case("primitive_float32_swapped", "decode_float32", {"words": [16256, 0], "swapped": True}, lambda: codec.decode_float32([16256, 0], swapped=True)),
        _success_case("primitive_float32_negative_zero", "encode_decode_float32", {"value": -0.0}, lambda: {"words": codec.encode_float32(-0.0), "value": codec.decode_float32(codec.encode_float32(-0.0))}),
        _success_case("primitive_float32_nan", "encode_decode_float32", {"value": float("nan")}, lambda: {"words": codec.encode_float32(float("nan")), "value": codec.decode_float32(codec.encode_float32(float("nan")))}),
        _success_case("primitive_float32_positive_infinity", "encode_decode_float32", {"value": float("inf")}, lambda: {"words": codec.encode_float32(float("inf")), "value": codec.decode_float32(codec.encode_float32(float("inf")))}),
        _success_case("primitive_float32_negative_infinity", "encode_decode_float32", {"value": float("-inf")}, lambda: {"words": codec.encode_float32(float("-inf")), "value": codec.decode_float32(codec.encode_float32(float("-inf")))}),
        _success_case("primitive_float32_finite_max", "encode_decode_float32", {"value": 3.4028234663852886e38}, lambda: codec.decode_float32(codec.encode_float32(3.4028234663852886e38))),
        _success_case("primitive_float32_subnormal", "encode_decode_float32", {"value": 1.401298464324817e-45}, lambda: codec.decode_float32(codec.encode_float32(1.401298464324817e-45))),
        _error_case("primitive_float32_overflow", "encode_float32", {"value": 3.5e38}, "codec_float_overflow", lambda: codec.encode_float32(3.5e38)),
        _error_case("primitive_float32_word_below_range", "decode_float32", {"words": [-1, 0]}, "codec_word_range", lambda: codec.decode_float32([-1, 0])),
        _error_case("primitive_float32_word_above_range", "decode_float32", {"words": [65536, 0]}, "codec_word_range", lambda: codec.decode_float32([65536, 0])),
        _success_case("primitive_int8_boundaries", "int8", {"values": [-128, 127]}, lambda: [{"value": value, "word": codec.encode_int8(value), "decoded": codec.decode_int8(codec.encode_int8(value))} for value in (-128, 127)]),
        _success_case("primitive_int8_masking", "decode_int8", {"words": [-1, 511]}, lambda: [codec.decode_int8(-1), codec.decode_int8(511)]),
        _error_case("primitive_int8_below_range", "encode_int8", {"value": -129}, "codec_int8_range", lambda: codec.encode_int8(-129)),
        _error_case("primitive_int8_above_range", "encode_int8", {"value": 128}, "codec_int8_range", lambda: codec.encode_int8(128)),
        _success_case("primitive_int16_boundaries", "int16", {"values": [-32768, 32767]}, lambda: [{"value": value, "word": codec.encode_int16(value), "decoded": codec.decode_int16(codec.encode_int16(value))} for value in (-32768, 32767)]),
        _success_case("primitive_int16_masking", "decode_int16", {"words": [-1, 131071]}, lambda: [codec.decode_int16(-1), codec.decode_int16(131071)]),
        _error_case("primitive_int16_below_range", "encode_int16", {"value": -32769}, "codec_int16_range", lambda: codec.encode_int16(-32769)),
        _error_case("primitive_int16_above_range", "encode_int16", {"value": 32768}, "codec_int16_range", lambda: codec.encode_int16(32768)),
    ]

    def reg(kind: Any, name: str, **kwargs: Any) -> Any:
        return register_def(1, kind, name, **kwargs)

    float_reg = reg(datatype.FLOAT, "float_case")
    uchar_reg = reg(datatype.UCHAR, "uchar_case")
    int8_reg = reg(datatype.INT8, "int8_case")
    int16_reg = reg(datatype.INT16, "int16_case")
    uint16_reg = reg(datatype.UINT16, "uint16_case")
    bool_reg = reg(datatype.BOOL, "bool_case")
    bitflag_reg = reg(datatype.BITFLAG, "bitflag_case")
    register: list[dict[str, Any]] = [
        _success_case("register_float_extra_word", "decode_value", {"datatype": "FLOAT", "words": [0, 16256, 65535]}, lambda: client.decode_value([0, 16256, 65535], float_reg)),
        _error_case("register_float_short", "decode_value", {"datatype": "FLOAT", "words": [0]}, "codec_input_short", lambda: client.decode_value([0], float_reg)),
        _error_case("register_empty", "decode_value", {"datatype": "UCHAR", "words": []}, "codec_input_empty", lambda: client.decode_value([], uchar_reg)),
        _success_case("register_float_nan_unavailable", "decode_value", {"datatype": "FLOAT", "words": codec.encode_float32(float("nan"))}, lambda: client.decode_value(codec.encode_float32(float("nan")), float_reg)),
        _success_case("register_float_negative_zero", "decode_value", {"datatype": "FLOAT", "words": codec.encode_float32(-0.0)}, lambda: client.decode_value(codec.encode_float32(-0.0), float_reg)),
        _success_case("register_uchar_masking", "decode_value", {"datatype": "UCHAR", "words": [511]}, lambda: client.decode_value([511], uchar_reg)),
        _success_case("register_int8_masking", "decode_value", {"datatype": "INT8", "words": [511]}, lambda: client.decode_value([511], int8_reg)),
        _success_case("register_int16_masking", "decode_value", {"datatype": "INT16", "words": [131071]}, lambda: client.decode_value([131071], int16_reg)),
        _success_case("register_uint16_direct_first_word", "decode_value", {"datatype": "UINT16", "words": [-1, 2]}, lambda: client.decode_value([-1, 2], uint16_reg)),
        _success_case("register_bool_masking", "decode_value", {"datatype": "BOOL", "words": [0, 1, 2, 3]}, lambda: [client.decode_value([word], bool_reg) for word in (0, 1, 2, 3)]),
        _success_case("register_bitflag_masking", "decode_value", {"datatype": "BITFLAG", "words": [511]}, lambda: client.decode_value([511], bitflag_reg)),
        _success_case("register_integer_tie_rounding", "encode_value", {"datatype": "UCHAR", "values": [2.5, 3.5]}, lambda: [client.encode_value(value, uchar_reg) for value in (2.5, 3.5)]),
        _success_case("register_multiplier", "encode_decode_value", {"datatype": "UINT16", "multiplier": 0.1, "value": 12.3}, lambda: {"encoded": client.encode_value(12.3, reg(datatype.UINT16, "scaled", multiplier=0.1)), "decoded": client.decode_value([123], reg(datatype.UINT16, "scaled", multiplier=0.1))}),
        _success_case("register_round_two_digits", "decode_value", {"datatype": "FLOAT", "values": [1.005, 2.675, -1.225]}, lambda: [client.decode_value(codec.encode_float32(value), float_reg) for value in (1.005, 2.675, -1.225)]),
        _error_case("register_uchar_below_range", "encode_value", {"datatype": "UCHAR", "value": -1}, "codec_uchar_range", lambda: client.encode_value(-1, uchar_reg)),
        _error_case("register_uint16_above_range", "encode_value", {"datatype": "UINT16", "value": 65536}, "codec_uint16_range", lambda: client.encode_value(65536, uint16_reg)),
        _error_case("register_float_encode_nonfinite", "encode_value", {"datatype": "FLOAT", "value": float("inf")}, "codec_nonfinite", lambda: client.encode_value(float("inf"), float_reg)),
    ]
    return _fixture_root(manifest, layers={"primitive": {"cases": primitive}, "register": {"cases": register}})


REGISTER_FIELDS = (
    "address", "datatype", "name", "unit", "writable", "min_val", "max_val", "enum_options",
    "multiplier", "register_type", "eeprom_sensitive", "cyclic_required", "cyclic_write_ttl",
    "binary", "enabled_by_default", "state_class", "icon", "write_only", "write_class",
    "exclude_from_write", "source", "source_version", "supported_models", "sentinel_values",
    "last_verified", "size",
)


def _serialize_register(register: Any) -> dict[str, Any]:
    return {
        "address": register.address,
        "datatype": register.datatype.value,
        "name": register.name,
        "unit": register.unit,
        "writable": register.writable,
        "min_val": register.min_val,
        "max_val": register.max_val,
        "enum_options": {str(key): value for key, value in sorted((register.enum_options or {}).items())},
        "multiplier": register.multiplier,
        "register_type": register.register_type.value,
        "eeprom_sensitive": register.eeprom_sensitive,
        "cyclic_required": register.cyclic_required,
        "cyclic_write_ttl": register.cyclic_write_ttl,
        "binary": register.binary,
        "enabled_by_default": register.enabled_by_default,
        "state_class": register.state_class,
        "icon": register.icon,
        "write_only": register.write_only,
        "write_class": register.write_class.value,
        "exclude_from_write": sorted(register.exclude_from_write or []),
        "source": register.source,
        "source_version": register.source_version,
        "supported_models": list(register.supported_models),
        "sentinel_values": list(register.sentinel_values),
        "last_verified": register.last_verified,
        "size": register.size,
    }


def _serialize_map(registers: Mapping[str, Any]) -> dict[str, Any]:
    return {key: _serialize_register(registers[key]) for key in sorted(registers)}


def _builder_rejection(identifier: str, code: str, callback: Any) -> dict[str, Any]:
    try:
        callback()
    except Exception as error:  # noqa: BLE001
        return {"id": identifier, "error": _validation_error(code, str(error))}
    fail("fixture_invalid", f"expected builder rejection did not occur: {identifier}")


def _builder_count_outcome(identifier: str, inputs: Any, callback: Any) -> dict[str, Any]:
    try:
        result = callback()
    except (TypeError, ValueError) as error:
        return {
            "id": identifier,
            "input": normalize_contract_value(inputs),
            "outcome": "rejected",
            "error": {"python_type": type(error).__name__, "diagnostic": str(error)[:240]},
        }
    return {
        "id": identifier,
        "input": normalize_contract_value(inputs),
        "outcome": "accepted",
        "register_count": len(result),
    }


def _model_info(client_module: Any, model: str, circuits: list[str], zones: int, **features: bool) -> Any:
    return client_module.IdmModelInfo(
        model_name=model,
        active_heating_circuits=circuits,
        zone_modules=zones,
        has_solar=features.get("solar", False),
        has_isc=features.get("isc", False),
        has_pv=features.get("pv", False),
        has_cascade=features.get("cascade", False),
    )


def _register_fixture(manifest: Mapping[str, Any], checkout: Path, client_module: Any, constants: Any, registers: Any) -> dict[str, Any]:
    navigator_20 = _model_info(client_module, constants.MODEL_NAVIGATOR_20, ["A"], 0)
    navigator_10 = _model_info(
        client_module,
        constants.MODEL_NAVIGATOR_10,
        list("ABCDEFG"),
        10,
        solar=True,
        isc=True,
        pv=True,
        cascade=True,
    )
    current_schema = {
        "schema_version": 1,
        "maps": {
            "default": _serialize_map(registers.build_register_map()),
            "navigator_10_full": _serialize_map(registers.build_register_map(model_info=navigator_10)),
            "navigator_20_circuit_a": _serialize_map(registers.build_register_map(model_info=navigator_20)),
        },
    }
    snapshot_path = checkout / "tests" / "fixtures" / "register_schema_v1.json"
    snapshot_bytes = snapshot_path.read_bytes()
    try:
        snapshot = json.loads(snapshot_bytes)
    except json.JSONDecodeError as error:
        fail("fixture_invalid", f"upstream register snapshot is invalid: {error}")
    if current_schema != snapshot:
        fail("fixture_invalid", "generated register maps differ from pinned upstream snapshot")
    expected_snapshot_bytes = (json.dumps(current_schema, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    if snapshot_bytes != expected_snapshot_bytes:
        fail("fixture_invalid", "pinned register snapshot bytes are not canonical")
    expected_counts = {"default": 267, "navigator_10_full": 587, "navigator_20_circuit_a": 105}
    if {name: len(values) for name, values in current_schema["maps"].items()} != expected_counts:
        fail("fixture_invalid", "pinned register map counts changed")
    for values in current_schema["maps"].values():
        for register in values.values():
            if tuple(register) != REGISTER_FIELDS:
                fail("fixture_invalid", "register serialization does not contain the exact 26 fields")

    circuits = []
    for letter in "ABCDEFG":
        built = registers.get_heating_circuit_registers(letter)
        circuits.append(
            {
                "letter": letter,
                "register_count": len(built),
                "addresses": {name: definition.address for name, definition in sorted(built.items())},
            }
        )
    zones = []
    for zone in range(1, 11):
        built = registers.get_zone_module_registers(zone, room_count=6)
        zones.append(
            {
                "zone": zone,
                "register_count": len(built),
                "base_address": built[f"zm{zone}_mode_heat_cool"].address,
                "last_address": max(item.address + item.size - 1 for item in built.values()),
            }
        )
    rooms = []
    for count in range(1, 9):
        built = registers.get_zone_module_registers(1, room_count=count)
        rooms.append(
            {
                "room_count": count,
                "register_count": len(built),
                "last_relay_address": built[f"zm1_room{count}_relay"].address,
            }
        )
    model_summaries = []
    for model_name in (
        constants.MODEL_NAVIGATOR_10,
        constants.MODEL_NAVIGATOR_20,
        constants.MODEL_NAVIGATOR_PRO,
        constants.MODEL_UNKNOWN,
    ):
        info = _model_info(client_module, model_name, ["A"], 0)
        built = registers.build_register_map(model_info=info)
        model_summaries.append(
            {
                "model_name": model_name,
                "register_count": len(built),
                "includes_navigator_10_block": "power_limit_hp" in built,
                "includes_circuit_a": "hc_a_flow_temp" in built,
            }
        )
    feature_summaries = []
    for feature in ("solar", "isc", "pv", "cascade"):
        base_info = _model_info(client_module, constants.MODEL_NAVIGATOR_10, [], 0)
        feature_info = _model_info(client_module, constants.MODEL_NAVIGATOR_10, [], 0, **{feature: True})
        base = registers.build_register_map(model_info=base_info)
        featured = registers.build_register_map(model_info=feature_info)
        feature_summaries.append(
            {
                "feature": feature,
                "added_registers": sorted(set(featured) - set(base)),
            }
        )
    for feature, info in (
        ("heating_circuits", _model_info(client_module, constants.MODEL_NAVIGATOR_10, ["A"], 0)),
        ("zone_modules", _model_info(client_module, constants.MODEL_NAVIGATOR_10, [], 1)),
    ):
        base = registers.build_register_map(model_info=_model_info(client_module, constants.MODEL_NAVIGATOR_10, [], 0))
        featured = registers.build_register_map(model_info=info)
        feature_summaries.append({"feature": feature, "added_registers": sorted(set(featured) - set(base))})

    precedence_info = _model_info(client_module, constants.MODEL_NAVIGATOR_20, ["A"], 0)
    precedence_map = registers.build_register_map(
        model_info=precedence_info,
        circuits=["G"],
        zone_modules=10,
        rooms_per_zone=8,
    )
    zero_zone_model = _model_info(client_module, constants.MODEL_NAVIGATOR_20, [], 0)
    one_zone_model = _model_info(client_module, constants.MODEL_NAVIGATOR_20, [], 1)
    count_boundaries = [
        _builder_count_outcome("direct_fractional_room", {"room_count": 1.5}, lambda: registers.get_zone_module_registers(1, room_count=1.5)),
        _builder_count_outcome("direct_nan_room", {"room_count": float("nan")}, lambda: registers.get_zone_module_registers(1, room_count=float("nan"))),
        _builder_count_outcome("direct_positive_infinite_room", {"room_count": float("inf")}, lambda: registers.get_zone_module_registers(1, room_count=float("inf"))),
        _builder_count_outcome("direct_negative_infinite_room", {"room_count": float("-inf")}, lambda: registers.get_zone_module_registers(1, room_count=float("-inf"))),
        _builder_count_outcome("manual_fractional_zone_active", {"zone_modules": 1.5}, lambda: registers.build_register_map(zone_modules=1.5)),
        _builder_count_outcome("manual_nan_zone", {"zone_modules": float("nan")}, lambda: registers.build_register_map(zone_modules=float("nan"))),
        _builder_count_outcome("manual_positive_infinite_zone", {"zone_modules": float("inf")}, lambda: registers.build_register_map(zone_modules=float("inf"))),
        _builder_count_outcome("manual_negative_infinite_zone", {"zone_modules": float("-inf")}, lambda: registers.build_register_map(zone_modules=float("-inf"))),
        _builder_count_outcome("manual_fractional_room_ignored_without_zones", {"zone_modules": 0, "rooms_per_zone": 1.5}, lambda: registers.build_register_map(zone_modules=0, rooms_per_zone=1.5)),
        _builder_count_outcome("manual_fractional_room_active", {"zone_modules": 1, "rooms_per_zone": 1.5}, lambda: registers.build_register_map(zone_modules=1, rooms_per_zone=1.5)),
        _builder_count_outcome("manual_nan_room_ignored_without_zones", {"zone_modules": 0, "rooms_per_zone": float("nan")}, lambda: registers.build_register_map(zone_modules=0, rooms_per_zone=float("nan"))),
        _builder_count_outcome("manual_positive_infinite_room_ignored_without_zones", {"zone_modules": 0, "rooms_per_zone": float("inf")}, lambda: registers.build_register_map(zone_modules=0, rooms_per_zone=float("inf"))),
        _builder_count_outcome("manual_negative_infinite_room_ignored_without_zones", {"zone_modules": 0, "rooms_per_zone": float("-inf")}, lambda: registers.build_register_map(zone_modules=0, rooms_per_zone=float("-inf"))),
        _builder_count_outcome("model_ignores_fractional_manual_counts", {"model_zone_modules": 0, "zone_modules": 1.5, "rooms_per_zone": 1.5}, lambda: registers.build_register_map(model_info=zero_zone_model, zone_modules=1.5, rooms_per_zone=1.5)),
        _builder_count_outcome("model_does_not_ignore_nan_manual_zone", {"model_zone_modules": 0, "zone_modules": float("nan")}, lambda: registers.build_register_map(model_info=zero_zone_model, zone_modules=float("nan"))),
        _builder_count_outcome("model_fractional_zone_active", {"model_zone_modules": 1.5}, lambda: registers.build_register_map(model_info=_model_info(client_module, constants.MODEL_NAVIGATOR_20, [], 1.5))),
        _builder_count_outcome("model_nan_zone", {"model_zone_modules": float("nan")}, lambda: registers.build_register_map(model_info=_model_info(client_module, constants.MODEL_NAVIGATOR_20, [], float("nan")))),
        _builder_count_outcome("model_positive_infinite_zone", {"model_zone_modules": float("inf")}, lambda: registers.build_register_map(model_info=_model_info(client_module, constants.MODEL_NAVIGATOR_20, [], float("inf")))),
        _builder_count_outcome("model_negative_infinite_zone", {"model_zone_modules": float("-inf")}, lambda: registers.build_register_map(model_info=_model_info(client_module, constants.MODEL_NAVIGATOR_20, [], float("-inf")))),
        _builder_count_outcome("model_fractional_room_active", {"model_zone_modules": 1, "rooms_per_zone": 1.5}, lambda: registers.build_register_map(model_info=one_zone_model, rooms_per_zone=1.5)),
    ]
    detection = [_serialize_register(register) for register in registers.get_detection_registers()]
    registry_surface = {
        "constructor": _class_constructor_fact(registers.RegisterRegistry),
        "members": _class_members(registers.RegisterRegistry),
    }
    builder_contract = {
        "circuits": circuits,
        "invalid_circuits": [
            _builder_rejection("empty", "circuit_invalid", lambda: registers.get_heating_circuit_registers("")),
            _builder_rejection("multi_letter", "circuit_invalid", lambda: registers.get_heating_circuit_registers("AB")),
            _builder_rejection("outside_A_G", "circuit_invalid", lambda: registers.get_heating_circuit_registers("H")),
        ],
        "zones": zones,
        "invalid_zones": [
            _builder_rejection("zone_zero", "zone_invalid", lambda: registers.get_zone_module_registers(0)),
            _builder_rejection("zone_eleven", "zone_invalid", lambda: registers.get_zone_module_registers(11)),
        ],
        "rooms": rooms,
        "count_boundaries": count_boundaries,
        "invalid_rooms": [
            _builder_rejection("room_zero", "room_invalid", lambda: registers.get_zone_module_registers(1, room_count=0)),
            _builder_rejection("room_nine", "room_invalid", lambda: registers.get_zone_module_registers(1, room_count=9)),
        ],
        "models": model_summaries,
        "features": feature_summaries,
        "model_info_precedence": {
            "requested_manual_circuit": "G",
            "requested_manual_zones": 10,
            "actual_circuits": [letter for letter in "ABCDEFG" if f"hc_{letter.lower()}_flow_temp" in precedence_map],
            "actual_zone_modules": sum(f"zm{zone}_mode_heat_cool" in precedence_map for zone in range(1, 11)),
        },
        "lookup_defaults": {
            "core_keys": sorted(registers.CORE_REGISTERS),
            "get_all_default_count": len(registers.get_all_registers()),
            "full_default_count": len(registers.build_register_map()),
        },
        "detection_registers": detection,
        "registry_surface": registry_surface,
    }
    return _fixture_root(
        manifest,
        upstream_snapshot={
            "path": "tests/fixtures/register_schema_v1.json",
            "sha256": hashlib.sha256(snapshot_bytes).hexdigest(),
        },
        maps=current_schema["maps"],
        documented_overlaps=[
            {"address": 1393, "names": ["hc_a_mode", "humidity_sensor"]},
            {"address": 1442, "names": ["hc_a_heating_limit", "hc_g_heating_curve"]},
            {"address": 1484, "names": ["hc_a_cooling_limit", "hc_g_room_setpoint_cool_eco"]},
        ],
        builder_contract=builder_contract,
    )


def _scenario(name: str, configuration: Any, operation: Any, expected_result: Any) -> dict[str, Any]:
    return {
        "name": name,
        "configuration": configuration,
        "transport_responses": [],
        "clock": [],
        "operation": operation,
        "expected_result": expected_result,
        "expected_requests": [],
        "expected_state": {},
    }


class _HashableMapping(Mapping[str, Any]):
    """Identity-hashable mapping used only to exercise normalized set ordering."""

    def __init__(self, values: Mapping[str, Any]) -> None:
        self._values = dict(values)

    def __getitem__(self, key: str) -> Any:
        return self._values[key]

    def __iter__(self) -> Iterator[str]:
        return iter(self._values)

    def __len__(self) -> int:
        return len(self._values)

    __hash__ = object.__hash__


def _structural_ordering_vectors() -> dict[str, Any]:
    finite = {
        -1e21,
        -1e20,
        -1e16,
        -1e15,
        -42.5,
        -1e-4,
        -1e-5,
        -1e-6,
        -1e-7,
        -1e-9,
        -1e-10,
        1e-10,
        1e-9,
        1e-7,
        1e-6,
        1e-5,
        1e-4,
        42.5,
        1e15,
        1e16,
        1e20,
        1e21,
    }
    mixed = {
        _HashableMapping({"10": -1e-10}),
        _HashableMapping({"2": 1e-10, "10": -1e-10}),
        _HashableMapping({"10": 1e-10}),
        _HashableMapping({"2": 0}),
        ("nested",),
        ("nested", _HashableMapping({"exponent": 1e-10})),
        ("nested", _HashableMapping({"exponent": 1e-9})),
        _HashableMapping({"$number": "NaN"}),
        _HashableMapping({"$number": "-Infinity"}),
        _HashableMapping({"$number": "+Infinity"}),
        _HashableMapping({"$number": "-0"}),
        "a",
        1e-10,
        -1e9,
        True,
        False,
        None,
    }
    return normalize_contract_value({"finite": finite, "mixed": mixed})


def _lossless_source_set_vectors() -> dict[str, Any]:
    first_nan = float("nan")
    second_nan = float("nan")
    return normalize_contract_value(
        {
            "negative_zero": {-0.0},
            "positive_zero": {0.0},
            "one_nan": {float("nan")},
            "two_distinct_nans": {first_nan, second_nan},
            "ordinary": {3, 1, 2},
            "nested": {frozenset({3, 1}), ("nested", -0.0)},
        }
    )


TRANSPORT_OPERATION_KINDS = (
    "lifecycle",
    "read_register",
    "read_batch",
    "probe",
    "detect_model",
    "diagnostics",
    "reset_failed_registers",
)
RUNTIME_SCENARIO_FIELDS = (
    "name",
    "configuration",
    "transport_responses",
    "clock",
    "operation",
    "expected_result",
    "expected_requests",
    "expected_state",
)
RUNTIME_NORMALIZATION_START = "<!-- runtime-normalization-contract:start -->"
RUNTIME_NORMALIZATION_END = "<!-- runtime-normalization-contract:end -->"
MAX_RUNTIME_DIAGNOSTIC = 1024
MIN_RUNTIME_TIMEOUT_MS = 1
MAX_RUNTIME_TIMEOUT_MS = 2_147_483_647


def _runtime_timeout_milliseconds(timeout: float) -> int:
    numeric = float(timeout)
    if not math.isfinite(numeric) or numeric <= 0:
        fail("fixture_invalid", "runtime request timeout must be finite and positive")
    scaled = numeric * 1000
    if not math.isfinite(scaled) or scaled >= MAX_RUNTIME_TIMEOUT_MS:
        return MAX_RUNTIME_TIMEOUT_MS
    return max(MIN_RUNTIME_TIMEOUT_MS, round(scaled))


def _runtime_normalization_contract() -> dict[str, Any]:
    path = Path(__file__).resolve().parents[1] / "contracts" / "normalization.md"
    try:
        text = path.read_text(encoding="utf-8")
        start = text.index(RUNTIME_NORMALIZATION_START) + len(RUNTIME_NORMALIZATION_START)
        end = text.index(RUNTIME_NORMALIZATION_END, start)
    except (OSError, UnicodeError, ValueError) as error:
        fail("fixture_invalid", f"runtime normalization contract is unavailable: {error}")
    fenced = text[start:end].strip()
    if not fenced.startswith("```json\n") or not fenced.endswith("\n```"):
        fail("fixture_invalid", "runtime normalization contract must use one JSON code fence")
    try:
        contract = json.loads(fenced.removeprefix("```json\n").removesuffix("\n```"))
    except json.JSONDecodeError as error:
        fail("fixture_invalid", f"runtime normalization contract is invalid JSON: {error}")
    if not isinstance(contract, dict) or contract.get("schema_version") != 1:
        fail("fixture_invalid", "runtime normalization contract schema is unsupported")
    return contract


def transport_error_type_to_closed_kind(source: str) -> str:
    contract = _runtime_normalization_contract().get("transport_error_type_to_closed_kind")
    if not isinstance(contract, dict) or contract.get("code") != "transport_error_type_to_closed_kind":
        fail("fixture_invalid", "runtime error normalization authority is missing")
    rules = contract.get("rules")
    kinds = contract.get("kinds")
    if not isinstance(rules, list) or not isinstance(kinds, list):
        fail("fixture_invalid", "runtime error normalization authority has invalid rules")
    source_to_kind = {
        rule.get("source"): rule.get("kind")
        for rule in rules
        if isinstance(rule, dict)
        and isinstance(rule.get("source"), str)
        and isinstance(rule.get("kind"), str)
    }
    kind = source_to_kind.get(source)
    if not isinstance(kind, str) or kind not in kinds:
        fail("fixture_invalid", f"runtime error source is not closed: {source}")
    return kind


def diagnostic_message_redaction(message: str, host: str, port: int) -> str:
    contract = _runtime_normalization_contract().get("diagnostic_message_redaction")
    if not isinstance(contract, dict) or contract.get("code") != "diagnostic_message_redaction":
        fail("fixture_invalid", "runtime diagnostic redaction authority is missing")
    templates = contract.get("python_candidates")
    if not isinstance(templates, list) or not all(isinstance(item, str) for item in templates):
        fail("fixture_invalid", "runtime diagnostic candidates are invalid")
    candidates = {
        template.replace("configured_host", host).replace("configured_port", str(port))
        for template in templates
    }
    if contract.get("order") != "longest_first":
        fail("fixture_invalid", "runtime diagnostic candidate order is unsupported")
    placeholder = contract.get("placeholder")
    if placeholder != "<endpoint>":
        fail("fixture_invalid", "runtime diagnostic placeholder is unsupported")
    redacted = message
    for candidate in sorted(candidates, key=lambda item: (-len(item), item)):
        redacted = redacted.replace(candidate, placeholder)
    maximum = contract.get("maximum_output_length")
    if not isinstance(maximum, int) or maximum != MAX_RUNTIME_DIAGNOSTIC:
        fail("fixture_invalid", "runtime diagnostic output limit is unsupported")
    if len(redacted) > maximum:
        fail("fixture_invalid", "runtime diagnostic message exceeds the contract limit")
    return redacted


def _runtime_error_projection(
    source: str,
    message: str,
    *,
    host: str = "example.invalid",
    port: int = 502,
) -> dict[str, str]:
    return {
        "errorType": transport_error_type_to_closed_kind(source),
        "message": diagnostic_message_redaction(message, host, port),
    }


def _runtime_words(words: Sequence[int], *, source: str | None = None) -> dict[str, Any]:
    script: dict[str, Any] = {"kind": "words", "words": [int(word) for word in words]}
    if source is not None:
        script["source"] = source
    return script


def _runtime_error(source: str, message: str | None = None) -> dict[str, Any]:
    return {"kind": "error", "source": source, "message": message}


class _RuntimeResponse:
    def __init__(
        self,
        *,
        registers: Sequence[int] | None = None,
        error: bool = False,
        exception_code: int | None = None,
    ) -> None:
        self.registers = list(registers or [])
        self.error = error
        self.exception_code = exception_code

    def isError(self) -> bool:  # noqa: N802 - pinned pymodbus compatibility
        return self.error or self.exception_code is not None

    def __str__(self) -> str:
        if self.exception_code is not None:
            return f"ExceptionResponse(exception_code={self.exception_code})"
        return "ErrorResponse()" if self.error else "ReadResponse()"


class _RuntimeHarness:
    def __init__(self, scripts: Sequence[Mapping[str, Any]], client_module: Any) -> None:
        self.scripts = [dict(script) for script in scripts]
        self.client_module = client_module
        self.events: list[dict[str, Any]] = []
        self.clock: list[float] = []
        self.elapsed = 0.0
        self.timeout_ms: int | None = None
        self.index = 0
        self.active_requests = 0
        self.max_active_requests = 0
        self.last_error_source: str | None = None
        self._original_sleep = asyncio.sleep

    async def wait_for(self, awaitable: Awaitable[Any], timeout: float) -> Any:
        previous = self.timeout_ms
        timeout_ms = _runtime_timeout_milliseconds(timeout)
        self.timeout_ms = timeout_ms
        try:
            return await awaitable
        finally:
            self.timeout_ms = previous

    async def sleep(self, delay: float) -> None:
        numeric = float(delay)
        if not math.isfinite(numeric) or numeric < 0:
            fail("fixture_invalid", "runtime controlled delay must be finite and non-negative")
        self.elapsed += numeric
        self.clock.append(self.elapsed)
        await self._original_sleep(0)

    def next_script(self, address: int) -> dict[str, Any]:
        if self.index >= len(self.scripts):
            fail("fixture_invalid", "runtime fake response script is exhausted")
        script = self.scripts[self.index]
        self.index += 1
        source = script.get("source")
        if isinstance(source, str):
            self.last_error_source = source
        if source == "numeric_modbus_exception_code_2":
            script["message"] = (
                f"Illegal Data Address reading address {address}: "
                "ExceptionResponse(exception_code=2)"
            )
        return script

    def assert_consumed(self) -> None:
        if self.index != len(self.scripts):
            fail(
                "fixture_invalid",
                f"runtime fake has {len(self.scripts) - self.index} unconsumed response(s)",
            )


class _RuntimeFakeTransport:
    def __init__(self, harness: _RuntimeHarness) -> None:
        self.harness = harness
        self.connected = True

    async def connect(self) -> bool:
        self.harness.events.append({"kind": "connect"})
        self.connected = True
        return True

    def close(self) -> None:
        self.harness.events.append({"kind": "close"})
        self.connected = False

    async def read_input_registers(self, *, address: int, count: int, **_: Any) -> Any:
        return await self._read("input", 4, address, count)

    async def read_holding_registers(self, *, address: int, count: int, **_: Any) -> Any:
        return await self._read("holding", 3, address, count)

    async def _read(
        self,
        register_type: str,
        function_code: int,
        address: int,
        count: int,
    ) -> _RuntimeResponse:
        self.harness.active_requests += 1
        self.harness.max_active_requests = max(
            self.harness.max_active_requests,
            self.harness.active_requests,
        )
        request: dict[str, Any] = {
            "unitId": 1,
            "registerType": register_type,
            "functionCode": function_code,
            "address": address,
            "count": count,
        }
        if self.harness.timeout_ms is not None:
            request["timeoutMs"] = self.harness.timeout_ms
        self.harness.events.append({"kind": "read", "request": request})
        try:
            await self.harness._original_sleep(0)
            script = self.harness.next_script(address)
            kind = script.get("kind")
            if kind == "words":
                words = script.get("words")
                if not isinstance(words, list):
                    fail("fixture_invalid", "runtime words script is invalid")
                return _RuntimeResponse(registers=words)
            if kind != "error":
                fail("fixture_invalid", "runtime response script kind is invalid")
            source = script.get("source")
            message = script.get("message")
            if not isinstance(source, str):
                fail("fixture_invalid", "runtime error script source is invalid")
            if source == "numeric_modbus_exception_code_2":
                return _RuntimeResponse(exception_code=2)
            if not isinstance(message, str):
                fail("fixture_invalid", "runtime error script message is invalid")
            if source == "timeout_exception":
                raise TimeoutError(message)
            if source == "connection_exception":
                raise self.harness.client_module.ConnectionException(message)
            if source == "socket_or_os_error":
                raise OSError(message)
            if source == "modbus_io_exception_or_structured_no_response":
                raise self.harness.client_module.ModbusIOException(message)
            if source == "other_modbus_exception":
                raise self.harness.client_module.ModbusException(message)
            fail("fixture_invalid", f"runtime fake cannot execute source: {source}")
        finally:
            self.harness.active_requests -= 1


def _runtime_script_contract(
    script: Mapping[str, Any],
    *,
    host: str,
    port: int,
) -> dict[str, Any]:
    if script.get("kind") == "words":
        words = script.get("words")
        if not isinstance(words, list):
            fail("fixture_invalid", "runtime words script is invalid")
        return {"kind": "words", "words": words}
    source = script.get("source")
    message = script.get("message")
    if not isinstance(source, str) or not isinstance(message, str):
        fail("fixture_invalid", "runtime error script is incomplete after execution")
    return {
        "kind": "error",
        **_runtime_error_projection(source, message, host=host, port=port),
    }


def _runtime_context_projection(
    context: Any,
    source: str | None,
    *,
    host: str,
    port: int,
) -> dict[str, Any] | None:
    if context is None:
        return None
    if source is None:
        fail("fixture_invalid", "runtime error context lacks structured source evidence")
    return {
        "operation": context.operation,
        "address": context.address,
        "count": context.count,
        "registerType": context.register_type,
        **_runtime_error_projection(source, context.message, host=host, port=port),
        "attempt": context.attempt,
    }


def _runtime_client_state(
    client: Any,
    harness: _RuntimeHarness,
    *,
    host: str,
    port: int,
) -> dict[str, Any]:
    return {
        "unsupportedRegisters": list(client.get_unsupported_registers()),
        "permanentlyFailedRegisters": sorted(client._permanently_failed_registers),
        "batchUnsafeRegisters": list(client.get_batch_unsafe_registers()),
        "transientFailures": {
            name: client._register_failures[name] for name in sorted(client._register_failures)
        },
        "connectionSuspect": client._connection_suspect,
        "connected": client.is_connected,
        "modelName": client.model_name,
        "lastError": _runtime_context_projection(
            client.get_last_error_context(),
            harness.last_error_source,
            host=host,
            port=port,
        ),
        "maxActiveRequests": harness.max_active_requests,
    }


def _runtime_exception_result(
    error: Exception,
    source: str | None,
    *,
    host: str,
    port: int,
) -> dict[str, Any]:
    if source is None:
        fail("fixture_invalid", f"runtime exception lacks structured source: {type(error).__name__}")
    return {"error": _runtime_error_projection(source, str(error), host=host, port=port)}


def _run_runtime_scenario(
    client_module: Any,
    *,
    name: str,
    operation: Mapping[str, Any],
    scripts: Sequence[Mapping[str, Any]],
    execute: Callable[[Any, _RuntimeFakeTransport, _RuntimeHarness], Awaitable[Any]],
    configuration: Mapping[str, Any] | None = None,
    setup: Callable[[Any], None] | None = None,
) -> dict[str, Any]:
    config = {
        "host": "example.invalid",
        "port": 502,
        "slaveId": 1,
        "timeout": 10,
        "maxRetries": 3,
        "maxGroupSize": 40,
        **dict(configuration or {}),
    }
    host = config["host"]
    port = config["port"]
    if host != "example.invalid" or not isinstance(port, int):
        fail("fixture_invalid", "runtime scenarios must use the synthetic endpoint")
    harness = _RuntimeHarness(scripts, client_module)
    transport = _RuntimeFakeTransport(harness)
    client = client_module.IdmModbusClient(
        host,
        port=port,
        slave_id=config["slaveId"],
        timeout=config["timeout"],
        max_retries=config["maxRetries"],
        pymodbus_retries=0,
        max_group_size=config["maxGroupSize"],
    )
    if setup is not None:
        setup(client)

    original_factory = client_module.AsyncModbusTcpClient
    original_sleep = client_module.asyncio.sleep
    original_wait_for = client_module.asyncio.wait_for
    client_module.AsyncModbusTcpClient = lambda **_: transport
    client_module.asyncio.sleep = harness.sleep
    client_module.asyncio.wait_for = harness.wait_for
    try:
        try:
            result = asyncio.run(execute(client, transport, harness))
        except Exception as error:  # noqa: BLE001 - source error becomes fixture data
            result = _runtime_exception_result(
                error,
                harness.last_error_source,
                host=host,
                port=port,
            )
    finally:
        client_module.AsyncModbusTcpClient = original_factory
        client_module.asyncio.sleep = original_sleep
        client_module.asyncio.wait_for = original_wait_for

    harness.assert_consumed()
    scenario = {
        "name": name,
        "configuration": config,
        "transport_responses": [
            _runtime_script_contract(script, host=host, port=port) for script in harness.scripts
        ],
        "clock": harness.clock,
        "operation": dict(operation),
        "expected_result": result,
        "expected_requests": harness.events,
        "expected_state": _runtime_client_state(
            client,
            harness,
            host=host,
            port=port,
        ),
    }
    if tuple(scenario) != RUNTIME_SCENARIO_FIELDS:
        fail("fixture_invalid", f"runtime scenario fields changed: {name}")
    return scenario


def _model_result(info: Any, registers: Any) -> dict[str, Any]:
    register_map = registers.build_register_map(model_info=info)
    return {
        "modelName": info.model_name,
        "activeHeatingCircuits": list(info.active_heating_circuits),
        "zoneModules": info.zone_modules,
        "hasSolar": info.has_solar,
        "hasIsc": info.has_isc,
        "hasPv": info.has_pv,
        "hasCascade": info.has_cascade,
        "features": sorted(info.features),
        "firmwareVersion": info.firmware_version,
        "registerMap": {
            "count": len(register_map),
            "keys": sorted(register_map),
        },
    }


def _behavior_fixture(manifest: Mapping[str, Any], client_module: Any, registers: Any) -> dict[str, Any]:
    codec = client_module.ModbusCodec
    scenarios = [
        _scenario(
            "normalize_exceptional_numbers",
            {},
            {"kind": "normalize_value", "values": ["NaN", "+Infinity", "-Infinity", "-0"]},
            normalize_contract_value([float("nan"), float("inf"), float("-inf"), -0.0]),
        ),
        _scenario(
            "canonical_unicode_ordering",
            {},
            {"kind": "normalize_value", "values": ["!", "10", "2", "Z", "_", "a", "z", "ä", "", "😀"]},
            normalize_contract_value(
                {
                    "strings": {"😀", "z", "ä", "a", "Z", "2", "10", "!", "_", ""},
                    "nested": {"2": "two", "10": "ten", "😀": {"2": 2, "10": 10}, "": True},
                }
            ),
        ),
        _scenario(
            "structural_set_ordering",
            {},
            {
                "kind": "normalize_value",
                "values": [
                    "finite_numbers",
                    "nested_arrays",
                    "nested_objects",
                    "exceptional_envelopes",
                ],
            },
            _structural_ordering_vectors(),
        ),
        _scenario(
            "lossless_source_set_members",
            {},
            {
                "kind": "normalize_value",
                "values": [
                    "negative_zero",
                    "positive_zero",
                    "one_nan",
                    "two_distinct_nans",
                    "ordinary",
                    "nested",
                ],
            },
            _lossless_source_set_vectors(),
        ),
        _scenario(
            "primitive_float_low_word_first",
            {},
            {"kind": "codec_encode_float32", "value": 1.0},
            codec.encode_float32(1.0),
        ),
        _scenario(
            "invalid_circuit_boundary",
            {"circuits": ["H"]},
            {"kind": "build_register_map"},
            _builder_rejection("outside_A_G", "circuit_invalid", lambda: registers.build_register_map(circuits=["H"]))["error"],
        ),
        _scenario(
            "documented_humidity_overlap",
            {"circuits": list("ABCDEFG")},
            {"kind": "register_overlap", "address": 1393},
            {
                "humidity": {"address": 1392, "count": 2},
                "heating_circuit_mode": {"address": 1393, "count": 1},
            },
        ),
    ]
    return _fixture_root(manifest, operation_kinds=["normalize_value", "codec_encode_float32", "build_register_map", "register_overlap"], scenarios=scenarios)


def _transport_fixture(
    manifest: Mapping[str, Any],
    client_module: Any,
    constants: Any,
    registers: Any,
) -> dict[str, Any]:
    codec = client_module.ModbusCodec
    register_map = registers.build_register_map()
    full_info = client_module.IdmModelInfo(
        model_name=constants.MODEL_NAVIGATOR_10,
        active_heating_circuits=list("ABCDEFG"),
        zone_modules=1,
        has_solar=True,
        has_isc=True,
        has_pv=True,
        has_cascade=True,
    )
    full_map = registers.build_register_map(model_info=full_info)

    async def lifecycle(client: Any, _: Any, __: Any) -> Any:
        await client.connect()
        await client.disconnect()
        await client.force_reconnect()
        return {
            "host": client.host,
            "port": client.port,
            "connected": client.is_connected,
        }

    async def constructor_defaults(client: Any, _: Any, __: Any) -> Any:
        return {
            "host": client.host,
            "port": client.port,
            "slaveId": client._slave_id,
            "timeout": client._timeout,
            "maxRetries": client._max_retries,
            "adapterRetries": client._pymodbus_retries,
            "maxGroupSize": client._max_group_size,
            "modelName": client.model_name,
        }

    def read_one(reg: Any) -> Callable[[Any, Any, Any], Awaitable[Any]]:
        async def execute(client: Any, transport: Any, _: Any) -> Any:
            client._client = transport
            return await client.read_register(reg)

        return execute

    def read_batch(
        selected: Sequence[Any],
        *,
        repetitions: int = 1,
    ) -> Callable[[Any, Any, Any], Awaitable[Any]]:
        async def execute(client: Any, transport: Any, _: Any) -> Any:
            client._client = transport
            results = []
            for _index in range(repetitions):
                results.append(await client.read_batch(list(selected)))
            return results[0] if repetitions == 1 else results

        return execute

    def raw_read(
        address: int,
        count: int,
        register_type: Any,
        *,
        max_retries: int | None = None,
        request_timeout: float | None = None,
    ) -> Callable[[Any, Any, Any], Awaitable[Any]]:
        async def execute(client: Any, transport: Any, _: Any) -> Any:
            client._client = transport
            return await client._read_registers(
                address,
                count,
                register_type,
                max_retries=max_retries,
                request_timeout=request_timeout,
            )

        return execute

    def detect(
        *,
        read_firmware: bool,
    ) -> Callable[[Any, Any, Any], Awaitable[Any]]:
        async def execute(client: Any, transport: Any, _: Any) -> Any:
            client._client = transport
            info = await client.detect_model(read_firmware=read_firmware)
            return _model_result(info, registers)

        return execute

    scenarios: list[dict[str, Any]] = [
        _run_runtime_scenario(
            client_module,
            name="constructor_defaults",
            operation={"kind": "diagnostics"},
            scripts=[],
            execute=constructor_defaults,
        ),
        _run_runtime_scenario(
            client_module,
            name="lifecycle_connect_disconnect_force_reconnect",
            operation={
                "kind": "lifecycle",
                "actions": ["connect", "disconnect", "force_reconnect"],
            },
            scripts=[],
            execute=lifecycle,
        ),
        _run_runtime_scenario(
            client_module,
            name="read_input_fc04",
            operation={
                "kind": "read_register",
                "register": "outdoor_temp",
                "concurrency": 1,
            },
            scripts=[_runtime_words(codec.encode_float32(21.5))],
            execute=read_one(register_map["outdoor_temp"]),
        ),
        _run_runtime_scenario(
            client_module,
            name="read_holding_fc03",
            operation={
                "kind": "probe",
                "address": 1200,
                "count": 1,
                "registerType": "holding",
                "maxRetries": 1,
                "timeout": 2,
            },
            scripts=[_runtime_words([7])],
            execute=raw_read(
                1200,
                1,
                client_module.RegisterType.HOLDING,
                max_retries=1,
                request_timeout=2,
            ),
        ),
        _run_runtime_scenario(
            client_module,
            name="probe_fractional_timeout_half_even",
            operation={
                "kind": "probe",
                "address": 1201,
                "count": 1,
                "registerType": "input",
                "maxRetries": 1,
                "timeout": 0.0015,
            },
            scripts=[_runtime_words([8])],
            execute=raw_read(
                1201,
                1,
                client_module.RegisterType.INPUT,
                max_retries=1,
                request_timeout=0.0015,
            ),
        ),
        _run_runtime_scenario(
            client_module,
            name="probe_timeout_lower_positive_boundary",
            operation={
                "kind": "probe",
                "address": 1202,
                "count": 1,
                "registerType": "input",
                "maxRetries": 1,
                "timeout": math.nextafter(0.0, math.inf),
            },
            scripts=[_runtime_words([9])],
            execute=raw_read(
                1202,
                1,
                client_module.RegisterType.INPUT,
                max_retries=1,
                request_timeout=math.nextafter(0.0, math.inf),
            ),
        ),
    ]

    async def serialization(client: Any, transport: Any, _: Any) -> Any:
        client._client = transport
        return await asyncio.gather(
            client.read_register(register_map["outdoor_temp"]),
            client.read_register(register_map["outdoor_temp_avg"]),
        )

    scenarios.append(
        _run_runtime_scenario(
            client_module,
            name="serialization_parallel_reads",
            operation={
                "kind": "read_batch",
                "registers": ["outdoor_temp", "outdoor_temp_avg"],
                "concurrency": 2,
            },
            scripts=[
                _runtime_words(codec.encode_float32(10.0)),
                _runtime_words(codec.encode_float32(12.5)),
            ],
            execute=serialization,
        )
    )

    batch_cases = [
        (
            "batch_adjacent",
            ["outdoor_temp", "outdoor_temp_avg"],
            [_runtime_words([*codec.encode_float32(10.0), *codec.encode_float32(12.5)])],
            {},
        ),
        (
            "batch_gap_split",
            ["outdoor_temp", "system_mode"],
            [_runtime_words(codec.encode_float32(10.0)), _runtime_words([2])],
            {},
        ),
        (
            "batch_max_span_split",
            ["outdoor_temp", "outdoor_temp_avg"],
            [_runtime_words(codec.encode_float32(10.0)), _runtime_words(codec.encode_float32(12.5))],
            {"maxGroupSize": 2},
        ),
        (
            "overlap_humidity_and_mode_1393",
            ["humidity_sensor", "hc_a_mode"],
            [_runtime_words(codec.encode_float32(54.75)), _runtime_words([2])],
            {},
        ),
        (
            "overlap_heating_curve_and_limit_1442",
            ["hc_g_heating_curve", "hc_a_heating_limit"],
            [_runtime_words(codec.encode_float32(0.45)), _runtime_words([42])],
            {},
        ),
        (
            "overlap_cooling_setpoint_and_limit_1484",
            ["hc_g_room_setpoint_cool_eco", "hc_a_cooling_limit"],
            [_runtime_words(codec.encode_float32(19.5)), _runtime_words([24])],
            {},
        ),
    ]
    for name, names, scripts, configuration in batch_cases:
        selected = [register_map[item] for item in names]
        scenarios.append(
            _run_runtime_scenario(
                client_module,
                name=name,
                operation={"kind": "read_batch", "registers": names, "concurrency": 1},
                scripts=scripts,
                execute=read_batch(selected),
                configuration=configuration,
            )
        )

    synthetic_input = client_module.RegisterDef(
        3000,
        client_module.DataType.UCHAR,
        "synthetic_input_3000",
        register_type=client_module.RegisterType.INPUT,
    )
    synthetic_holding = client_module.RegisterDef(
        3001,
        client_module.DataType.UCHAR,
        "synthetic_holding_3001",
        register_type=client_module.RegisterType.HOLDING,
    )
    scenarios.append(
        _run_runtime_scenario(
            client_module,
            name="batch_register_type_split",
            operation={
                "kind": "read_batch",
                "registers": [synthetic_input.name, synthetic_holding.name],
                "concurrency": 1,
            },
            scripts=[_runtime_words([1]), _runtime_words([2])],
            execute=read_batch([synthetic_input, synthetic_holding]),
            configuration={
                "registerDefinitions": [
                    {
                        "name": synthetic_input.name,
                        "address": synthetic_input.address,
                        "datatype": synthetic_input.datatype.value,
                        "registerType": synthetic_input.register_type.value,
                    },
                    {
                        "name": synthetic_holding.name,
                        "address": synthetic_holding.address,
                        "datatype": synthetic_holding.datatype.value,
                        "registerType": synthetic_holding.register_type.value,
                    },
                ]
            },
        )
    )

    retry_sources = (
        ("retry_timeout_reconnect", "timeout_exception", "timeout at example.invalid:502"),
        (
            "retry_disconnected_reconnect",
            "connection_exception",
            "disconnected from [example.invalid]:502",
        ),
        ("retry_socket_reconnect", "socket_or_os_error", "link reset by example.invalid"),
        (
            "retry_no_response_reconnect",
            "modbus_io_exception_or_structured_no_response",
            "no response from example.invalid:502",
        ),
    )
    for name, source, message in retry_sources:
        scenarios.append(
            _run_runtime_scenario(
                client_module,
                name=name,
                operation={
                    "kind": "probe",
                    "address": 1000,
                    "count": 2,
                    "registerType": "input",
                    "maxRetries": 2,
                    "timeout": 10,
                },
                scripts=[
                    _runtime_error(source, message),
                    _runtime_words(codec.encode_float32(18.25)),
                ],
                execute=raw_read(
                    1000,
                    2,
                    client_module.RegisterType.INPUT,
                    max_retries=2,
                ),
                configuration={"maxRetries": 2},
            )
        )

    scenarios.append(
        _run_runtime_scenario(
            client_module,
            name="retry_modbus_same_connection",
            operation={
                "kind": "probe",
                "address": 1000,
                "count": 2,
                "registerType": "input",
                "maxRetries": 2,
                "timeout": 10,
            },
            scripts=[
                _runtime_error(
                    "other_modbus_exception",
                    "device rejected read at example.invalid:502",
                ),
                _runtime_words(codec.encode_float32(18.25)),
            ],
            execute=raw_read(
                1000,
                2,
                client_module.RegisterType.INPUT,
                max_retries=2,
            ),
            configuration={"maxRetries": 2},
        )
    )
    scenarios.append(
        _run_runtime_scenario(
            client_module,
            name="retry_modbus_three_attempt_backoff",
            operation={
                "kind": "probe",
                "address": 1000,
                "count": 2,
                "registerType": "input",
                "maxRetries": 3,
                "timeout": 10,
            },
            scripts=[
                _runtime_error(
                    "other_modbus_exception",
                    "first rejection at example.invalid:502",
                ),
                _runtime_error(
                    "other_modbus_exception",
                    "second rejection at example.invalid:502",
                ),
                _runtime_words(codec.encode_float32(18.25)),
            ],
            execute=raw_read(
                1000,
                2,
                client_module.RegisterType.INPUT,
                max_retries=3,
            ),
            configuration={"maxRetries": 3},
        )
    )
    scenarios.append(
        _run_runtime_scenario(
            client_module,
            name="invalid_short_response",
            operation={
                "kind": "probe",
                "address": 1000,
                "count": 2,
                "registerType": "input",
                "maxRetries": 1,
                "timeout": 10,
            },
            scripts=[_runtime_words([1], source="malformed_response")],
            execute=raw_read(
                1000,
                2,
                client_module.RegisterType.INPUT,
                max_retries=1,
            ),
            configuration={"maxRetries": 1},
        )
    )

    scenarios.append(
        _run_runtime_scenario(
            client_module,
            name="batch_device_error_fallback",
            operation={
                "kind": "read_batch",
                "registers": ["outdoor_temp", "outdoor_temp_avg"],
                "concurrency": 1,
            },
            scripts=[
                _runtime_error(
                    "other_modbus_exception",
                    "batch rejected by example.invalid:502",
                ),
                _runtime_words(codec.encode_float32(10.0)),
                _runtime_words(codec.encode_float32(12.5)),
            ],
            execute=read_batch(
                [register_map["outdoor_temp"], register_map["outdoor_temp_avg"]]
            ),
            configuration={"maxRetries": 1},
        )
    )
    scenarios.append(
        _run_runtime_scenario(
            client_module,
            name="batch_transport_error_propagates",
            operation={
                "kind": "read_batch",
                "registers": ["outdoor_temp", "outdoor_temp_avg"],
                "concurrency": 1,
            },
            scripts=[
                _runtime_error(
                    "timeout_exception",
                    "batch timed out at example.invalid:502",
                )
            ],
            execute=read_batch(
                [register_map["outdoor_temp"], register_map["outdoor_temp_avg"]]
            ),
            configuration={"maxRetries": 1},
        )
    )
    scenarios.append(
        _run_runtime_scenario(
            client_module,
            name="unsupported_illegal_address",
            operation={
                "kind": "read_batch",
                "registers": ["internal_message", "system_mode"],
                "concurrency": 1,
            },
            scripts=[
                _runtime_error(
                    "other_modbus_exception",
                    "batch rejected by example.invalid:502",
                ),
                _runtime_words([7]),
                _runtime_error("numeric_modbus_exception_code_2"),
            ],
            execute=read_batch(
                [register_map["internal_message"], register_map["system_mode"]]
            ),
            configuration={"maxRetries": 1},
        )
    )

    repeated_modbus_errors = [
        _runtime_error(
            "other_modbus_exception",
            f"device failure {index + 1} at example.invalid:502",
        )
        for index in range(6)
    ]
    scenarios.append(
        _run_runtime_scenario(
            client_module,
            name="permanent_after_third_modbus_failure",
            operation={
                "kind": "read_batch",
                "registers": ["system_mode"],
                "concurrency": 1,
            },
            scripts=repeated_modbus_errors,
            execute=read_batch([register_map["system_mode"]], repetitions=3),
            configuration={"maxRetries": 1},
        )
    )

    def setup_transient_success(client: Any) -> None:
        client._register_failures["system_mode"] = 2
        client._batch_unsafe_registers.add("system_mode")

    scenarios.append(
        _run_runtime_scenario(
            client_module,
            name="successful_individual_read_clears_failure",
            operation={
                "kind": "read_batch",
                "registers": ["system_mode"],
                "concurrency": 1,
            },
            scripts=[_runtime_words([2])],
            execute=read_batch([register_map["system_mode"]]),
            setup=setup_transient_success,
        )
    )

    zone_mode = full_map["zm1_room1_mode"]
    zone_relay = full_map["zm1_room1_relay"]
    scenarios.append(
        _run_runtime_scenario(
            client_module,
            name="batch_suspect_quarantine_and_reread",
            operation={
                "kind": "read_batch",
                "registers": [zone_mode.name, zone_relay.name],
                "concurrency": 1,
            },
            scripts=[_runtime_words([255, 1]), _runtime_words([3])],
            execute=read_batch([zone_mode, zone_relay]),
        )
    )

    def setup_invalid_individual(client: Any) -> None:
        client._batch_unsafe_registers.add("humidity_sensor")

    scenarios.append(
        _run_runtime_scenario(
            client_module,
            name="invalid_individual_value_omitted",
            operation={
                "kind": "read_batch",
                "registers": ["humidity_sensor"],
                "concurrency": 1,
            },
            scripts=[_runtime_words(codec.encode_float32(188.0))],
            execute=read_batch([register_map["humidity_sensor"]]),
            setup=setup_invalid_individual,
        )
    )

    def setup_consumer_quarantine(client: Any) -> None:
        client.mark_batch_unsafe(zone_mode)

    scenarios.append(
        _run_runtime_scenario(
            client_module,
            name="consumer_quarantine_order",
            operation={
                "kind": "read_batch",
                "registers": [zone_mode.name, zone_relay.name],
                "concurrency": 1,
            },
            scripts=[_runtime_words([1]), _runtime_words([3])],
            execute=read_batch([zone_mode, zone_relay]),
            setup=setup_consumer_quarantine,
        )
    )

    scenarios.append(
        _run_runtime_scenario(
            client_module,
            name="sentinel_null_bool_are_not_quarantined",
            operation={
                "kind": "read_batch",
                "registers": ["outdoor_temp", "variable_input", "demand_heating"],
                "concurrency": 1,
            },
            scripts=[
                _runtime_words(codec.encode_float32(float("nan"))),
                _runtime_words([0xFFFF]),
                _runtime_words([1]),
            ],
            execute=read_batch(
                [
                    register_map["outdoor_temp"],
                    register_map["variable_input"],
                    register_map["demand_heating"],
                ]
            ),
        )
    )

    def detection_scenario(
        name: str,
        scripts: Sequence[Mapping[str, Any]],
        *,
        include_firmware: bool,
    ) -> dict[str, Any]:
        return _run_runtime_scenario(
            client_module,
            name=name,
            operation={"kind": "detect_model", "includeFirmware": include_firmware},
            scripts=scripts,
            execute=detect(read_firmware=include_firmware),
            configuration={"maxRetries": 3},
        )

    missing = lambda: _runtime_error("numeric_modbus_exception_code_2")
    scenarios.extend(
        [
            detection_scenario(
                "detect_unknown",
                [missing() for _ in range(10)],
                include_firmware=True,
            ),
            detection_scenario(
                "detect_navigator_20",
                [
                    _runtime_words(codec.encode_float32(25.0)),
                    missing(),
                    missing(),
                    missing(),
                    missing(),
                    missing(),
                    missing(),
                    missing(),
                    missing(),
                    missing(),
                ],
                include_firmware=False,
            ),
            detection_scenario(
                "detect_navigator_pro",
                [
                    missing(),
                    missing(),
                    _runtime_words([1]),
                    missing(),
                    missing(),
                    missing(),
                    missing(),
                    missing(),
                    missing(),
                    missing(),
                ],
                include_firmware=False,
            ),
            detection_scenario(
                "detect_navigator_10_full",
                [
                    _runtime_words(codec.encode_float32(25.0)),
                    missing(),
                    missing(),
                    _runtime_words([1]),
                    missing(),
                    missing(),
                    _runtime_words(codec.encode_float32(10.0)),
                    _runtime_words(codec.encode_float32(11.0)),
                    _runtime_words(codec.encode_float32(12.0)),
                    _runtime_words([0]),
                    _runtime_words(codec.encode_float32(40.0)),
                    _runtime_words(codec.encode_float32(7.45)),
                ],
                include_firmware=True,
            ),
            detection_scenario(
                "detect_unavailable_slots_and_cascade_sentinel",
                [
                    _runtime_words(codec.encode_float32(25.0)),
                    _runtime_words(codec.encode_float32(-1.0)),
                    _runtime_words(codec.encode_float32(-1.0)),
                    missing(),
                    missing(),
                    _runtime_words(codec.encode_float32(float("nan"))),
                    _runtime_words(codec.encode_float32(float("nan"))),
                    _runtime_words(codec.encode_float32(0.0)),
                    _runtime_words([0xFFFF]),
                    missing(),
                ],
                include_firmware=False,
            ),
        ]
    )

    async def diagnostics(client: Any, transport: Any, harness: _RuntimeHarness) -> Any:
        client._client = transport
        try:
            await client._read_registers(1000, 1, max_retries=1)
        except Exception:
            pass
        client._permanently_failed_registers.update({"system_mode", "outdoor_temp"})
        client._batch_unsafe_registers.update({"variable_input", "humidity_sensor"})
        snapshot = client.get_diagnostics()
        return {
            "navigatorType": snapshot.navigator_type,
            "modbusConnected": snapshot.modbus_connected,
            "firmware": snapshot.firmware,
            "lastError": (
                None
                if snapshot.last_error is None
                else diagnostic_message_redaction(snapshot.last_error, "example.invalid", 502)
            ),
            "permanentlyFailedRegisters": list(snapshot.permanently_failed_registers),
            "connectionSuspect": snapshot.connection_suspect,
            "batchUnsafeRegisters": list(snapshot.batch_unsafe_registers),
            "context": _runtime_context_projection(
                client.get_last_error_context(),
                harness.last_error_source,
                host="example.invalid",
                port=502,
            ),
        }

    scenarios.append(
        _run_runtime_scenario(
            client_module,
            name="diagnostics_redacted_error",
            operation={"kind": "diagnostics"},
            scripts=[
                _runtime_error(
                    "timeout_exception",
                    "example.invalid:502 [example.invalid]:502 example.invalid timed out",
                )
            ],
            execute=diagnostics,
            configuration={"maxRetries": 1},
        )
    )

    def setup_reset(client: Any) -> None:
        client._permanently_failed_registers.update({"system_mode", "outdoor_temp"})
        client._unsupported_registers.add("system_mode")
        client._register_failures.update({"system_mode": 3, "outdoor_temp": 1})
        client._batch_unsafe_registers.add("humidity_sensor")

    async def reset_state(client: Any, _: Any, __: Any) -> Any:
        client.reset_failed_registers()
        return {
            "unsupportedRegisters": list(client.get_unsupported_registers()),
            "batchUnsafeRegisters": list(client.get_batch_unsafe_registers()),
        }

    scenarios.append(
        _run_runtime_scenario(
            client_module,
            name="reset_failed_register_state",
            operation={"kind": "reset_failed_registers"},
            scripts=[],
            execute=reset_state,
            setup=setup_reset,
        )
    )

    names = [scenario["name"] for scenario in scenarios]
    if len(scenarios) < 30 or len(names) != len(set(names)):
        fail("fixture_invalid", "runtime scenario inventory must be complete and unique")
    if any(tuple(scenario) != RUNTIME_SCENARIO_FIELDS for scenario in scenarios):
        fail("fixture_invalid", "runtime scenarios must contain all eight CTR-01 fields")
    return _fixture_root(
        manifest,
        operation_kinds=list(TRANSPORT_OPERATION_KINDS),
        scenarios=scenarios,
    )


WRITE_ACTION_KINDS = (
    "simulate_write",
    "write_register",
    "set_value",
    "advance_time",
    "reset_write_throttle",
    "get_active_cyclic_writes",
    "get_expired_cyclic_writes",
    "reset_cyclic_write_state",
)


def _write_custom_register(
    name: str,
    address: int,
    datatype: str,
    *,
    writable: bool = True,
    **metadata: Any,
) -> dict[str, Any]:
    return {
        "address": address,
        "datatype": datatype,
        "name": name,
        "source": "synthetic_contract",
        "sourceVersion": "1",
        "supportedModels": ["Navigator 2.0", "Navigator 10", "Navigator Pro"],
        "writable": writable,
        **metadata,
    }


def _write_python_register(client_module: Any, value: Mapping[str, Any]) -> Any:
    arguments: dict[str, Any] = {
        "address": value["address"],
        "datatype": client_module.DataType(value["datatype"]),
        "name": value["name"],
        "source": value["source"],
        "source_version": value["sourceVersion"],
        "supported_models": tuple(value["supportedModels"]),
        "writable": value["writable"],
    }
    translations = {
        "binary": "binary",
        "cyclicRequired": "cyclic_required",
        "cyclicWriteTtl": "cyclic_write_ttl",
        "eepromSensitive": "eeprom_sensitive",
        "enabledByDefault": "enabled_by_default",
        "icon": "icon",
        "lastVerified": "last_verified",
        "maxVal": "max_val",
        "minVal": "min_val",
        "multiplier": "multiplier",
        "stateClass": "state_class",
        "unit": "unit",
        "writeOnly": "write_only",
    }
    for source, destination in translations.items():
        if source in value:
            arguments[destination] = value[source]
    if "enumOptions" in value:
        options = value["enumOptions"]
        arguments["enum_options"] = (
            None if options is None else {int(key): item for key, item in options.items()}
        )
    if "excludeFromWrite" in value:
        excluded = value["excludeFromWrite"]
        arguments["exclude_from_write"] = None if excluded is None else set(excluded)
    if "registerType" in value:
        arguments["register_type"] = client_module.RegisterType(value["registerType"])
    if "sentinelValues" in value:
        arguments["sentinel_values"] = tuple(value["sentinelValues"])
    return client_module.RegisterDef(**arguments)


class _WriteHarness:
    def __init__(self, scripts: Sequence[Mapping[str, Any]], client_module: Any) -> None:
        self.scripts = [dict(script) for script in scripts]
        self.client_module = client_module
        self.events: list[dict[str, Any]] = []
        self.clock: list[float] = []
        self.elapsed = 0.0
        self.index = 0
        self.active_requests = 0
        self.max_active_requests = 0
        self.last_error_source: str | None = None
        self._original_sleep = asyncio.sleep

    async def sleep(self, delay: float) -> None:
        numeric = float(delay)
        if not math.isfinite(numeric) or numeric < 0:
            fail("fixture_invalid", "write controlled delay must be finite and non-negative")
        self.elapsed += numeric
        self.clock.append(self.elapsed)
        await self._original_sleep(0)

    def next_script(self, address: int, count: int) -> dict[str, Any]:
        if self.index >= len(self.scripts):
            fail("fixture_invalid", "write fake response script is exhausted")
        script = self.scripts[self.index]
        self.index += 1
        source = script.get("source")
        if isinstance(source, str):
            self.last_error_source = source
        if script.get("kind") == "ack":
            script.setdefault("address", address)
            script.setdefault("count", count)
        if source == "numeric_modbus_exception_code_2":
            script["message"] = (
                f"Illegal Data Address writing address {address}: "
                "ExceptionResponse(exception_code=2)"
            )
        return script

    def assert_consumed(self) -> None:
        if self.index != len(self.scripts):
            fail(
                "fixture_invalid",
                f"write fake has {len(self.scripts) - self.index} unconsumed response(s)",
            )


class _WriteFakeTransport:
    def __init__(self, harness: _WriteHarness) -> None:
        self.harness = harness
        self.connected = True

    async def connect(self) -> bool:
        self.harness.events.append({"kind": "connect"})
        self.connected = True
        return True

    def close(self) -> None:
        self.harness.events.append({"kind": "close"})
        self.connected = False

    async def write_registers(self, *, address: int, values: Sequence[int], **kwargs: Any) -> Any:
        words = [int(value) for value in values]
        unit_id = next(iter(kwargs.values()), 1)
        request = {
            "unitId": int(unit_id),
            "registerType": "holding",
            "functionCode": 16,
            "address": address,
            "count": len(words),
            "words": words,
        }
        self.harness.events.append({"kind": "write", "request": request})
        self.harness.active_requests += 1
        self.harness.max_active_requests = max(
            self.harness.max_active_requests,
            self.harness.active_requests,
        )
        try:
            await self.harness._original_sleep(0)
            script = self.harness.next_script(address, len(words))
            kind = script.get("kind")
            if kind == "ack":
                return _RuntimeResponse()
            if kind != "error":
                fail("fixture_invalid", "write response script kind is invalid")
            source = script.get("source")
            message = script.get("message")
            if source == "numeric_modbus_exception_code_2":
                return _RuntimeResponse(exception_code=2)
            if not isinstance(source, str) or not isinstance(message, str):
                fail("fixture_invalid", "write error script is incomplete")
            if source == "timeout_exception":
                raise TimeoutError(message)
            if source == "connection_exception":
                raise self.harness.client_module.ConnectionException(message)
            if source == "socket_or_os_error":
                raise OSError(message)
            if source == "modbus_io_exception_or_structured_no_response":
                raise self.harness.client_module.ModbusIOException(message)
            if source == "other_modbus_exception":
                raise self.harness.client_module.ModbusException(message)
            if source == "structured_illegal_address_marker":
                raise self.harness.client_module.IllegalAddressError(message)
            fail("fixture_invalid", f"write fake cannot execute source: {source}")
        finally:
            self.harness.active_requests -= 1


def _write_error_projection(
    source: str,
    message: str,
    *,
    host: str,
    port: int,
) -> dict[str, str]:
    error_type = (
        "modbus"
        if source == "numeric_modbus_exception_code_2"
        else transport_error_type_to_closed_kind(source)
    )
    return {
        "errorType": error_type,
        "message": diagnostic_message_redaction(message, host, port),
    }


def _write_script_contract(script: Mapping[str, Any], *, host: str, port: int) -> dict[str, Any]:
    if script.get("kind") == "ack":
        address = script.get("address")
        count = script.get("count")
        if not isinstance(address, int) or not isinstance(count, int):
            fail("fixture_invalid", "write acknowledgement was not exercised")
        return {"kind": "ack", "address": address, "count": count}
    source = script.get("source")
    message = script.get("message")
    if not isinstance(source, str) or not isinstance(message, str):
        fail("fixture_invalid", "write error script is incomplete after execution")
    return {
        "kind": "error",
        **_write_error_projection(source, message, host=host, port=port),
    }


def _write_context_projection(
    client: Any,
    harness: _WriteHarness,
    *,
    host: str,
    port: int,
) -> dict[str, Any] | None:
    context = client.get_last_error_context()
    if context is None:
        return None
    if harness.last_error_source is None:
        fail("fixture_invalid", "write error context lacks structured source evidence")
    return {
        "operation": context.operation,
        "address": context.address,
        "count": context.count,
        "registerType": context.register_type,
        **_write_error_projection(
            harness.last_error_source,
            context.message,
            host=host,
            port=port,
        ),
        "attempt": context.attempt,
    }


def _write_state(client: Any, harness: _WriteHarness, *, host: str, port: int) -> dict[str, Any]:
    return {
        "activeCyclicWrites": {
            name: value for name, value in sorted(client.get_active_cyclic_writes().items())
        },
        "connected": client.is_connected,
        "connectionSuspect": client._connection_suspect,
        "cyclicWrites": {
            name: value for name, value in sorted(client._cyclic_write_deadlines.items())
        },
        "expiredCyclicWrites": sorted(client.get_expired_cyclic_writes()),
        "lastError": _write_context_projection(client, harness, host=host, port=port),
        "maxActiveRequests": harness.max_active_requests,
        "unsupportedRegisters": list(client.get_unsupported_registers()),
        "writeThrottle": {
            name: value for name, value in sorted(client._last_eeprom_writes.items())
        },
    }


def _write_plan_result(plan: Any) -> dict[str, Any]:
    return {
        "dryRun": plan.dry_run,
        "encodedRegisters": list(plan.encoded_registers),
        "register": {"address": plan.register.address, "name": plan.register.name},
        "requestedValue": plan.requested_value,
    }


def _write_resolve_register(
    client_module: Any,
    registers: Any,
    client: Any,
    operand: Any,
) -> Any:
    if isinstance(operand, str):
        return registers.get_register(operand, model_info=client._model_info)
    return _write_python_register(client_module, operand)


async def _execute_write_action(
    action: Mapping[str, Any],
    client: Any,
    client_module: Any,
    registers: Any,
    harness: _WriteHarness,
) -> Any:
    kind = action["kind"]
    if kind == "advance_time":
        harness.elapsed += float(action["seconds"])
        return None
    if kind == "get_active_cyclic_writes":
        return {name: value for name, value in sorted(client.get_active_cyclic_writes().items())}
    if kind == "get_expired_cyclic_writes":
        return sorted(client.get_expired_cyclic_writes())
    if kind == "reset_write_throttle":
        register = (
            None
            if "register" not in action
            else _write_resolve_register(client_module, registers, client, action["register"])
        )
        client.reset_write_throttle(register)
        return None
    if kind == "reset_cyclic_write_state":
        register = (
            None
            if "register" not in action
            else _write_resolve_register(client_module, registers, client, action["register"])
        )
        client.reset_cyclic_write_state(register)
        return None
    if kind == "set_value":
        return _write_plan_result(
            await client.set_value(action["key"], action["value"], dry_run=action["dryRun"])
        )
    register = _write_resolve_register(client_module, registers, client, action["register"])
    if kind == "simulate_write":
        return _write_plan_result(
            client.simulate_write(
                register,
                action["value"],
                dry_run=action["dryRun"],
                allow_custom_register=action["allowCustomRegister"],
            )
        )
    if kind == "write_register":
        await client.write_register(
            register,
            action["value"],
            allow_custom_register=action["allowCustomRegister"],
        )
        return None
    fail("fixture_invalid", f"unknown write action kind: {kind}")


def _write_scenario(
    client_module: Any,
    registers: Any,
    *,
    name: str,
    actions: Sequence[Mapping[str, Any]],
    scripts: Sequence[Mapping[str, Any]] = (),
    validation_codes: Sequence[str | None] = (),
    detected_model: str | None = None,
) -> dict[str, Any]:
    codes = list(validation_codes) or [None] * len(actions)
    if len(codes) != len(actions):
        fail("fixture_invalid", f"write validation-code matrix is incomplete: {name}")
    custom_definitions: dict[str, Mapping[str, Any]] = {}
    for action in actions:
        operand = action.get("register")
        if isinstance(operand, Mapping):
            custom_definitions[str(operand["name"])] = operand
    configuration = {
        "detectedModel": detected_model,
        "host": "example.invalid",
        "maxGroupSize": 40,
        "maxRetries": 3,
        "port": 502,
        "registerDefinitions": list(custom_definitions.values()),
        "slaveId": 1,
        "timeout": 10,
    }
    harness = _WriteHarness(scripts, client_module)
    transport = _WriteFakeTransport(harness)
    client = client_module.IdmModbusClient(
        configuration["host"],
        port=configuration["port"],
        slave_id=configuration["slaveId"],
        timeout=configuration["timeout"],
        max_retries=configuration["maxRetries"],
        pymodbus_retries=0,
        max_group_size=configuration["maxGroupSize"],
    )
    client._client = transport
    client._time = lambda: harness.elapsed
    if detected_model is not None:
        client._model_info = client_module.IdmModelInfo(
            model_name=detected_model,
            active_heating_circuits=["A"],
            zone_modules=0,
            has_solar=False,
            has_isc=False,
            has_pv=False,
            has_cascade=False,
        )
    original_factory = client_module.AsyncModbusTcpClient
    original_sleep = client_module.asyncio.sleep
    client_module.AsyncModbusTcpClient = lambda **_: transport
    client_module.asyncio.sleep = harness.sleep

    async def execute() -> list[dict[str, Any]]:
        steps: list[dict[str, Any]] = []
        for index, action in enumerate(actions):
            try:
                value = await _execute_write_action(
                    action,
                    client,
                    client_module,
                    registers,
                    harness,
                )
                if codes[index] is not None:
                    fail("fixture_invalid", f"expected write validation rejection did not occur: {name}")
                result = {"kind": "value", "value": value}
            except Exception as error:  # noqa: BLE001 - exact Python rejection is fixture data
                code = codes[index]
                if code is not None:
                    result = {
                        "kind": "error",
                        "category": "validation",
                        "code": code,
                        "diagnostic": str(error),
                    }
                elif harness.last_error_source is not None:
                    result = {
                        "kind": "error",
                        "category": "transport",
                        **_write_error_projection(
                            harness.last_error_source,
                            str(error),
                            host=configuration["host"],
                            port=configuration["port"],
                        ),
                    }
                else:
                    raise
            steps.append(
                {
                    "result": result,
                    "state": _write_state(
                        client,
                        harness,
                        host=configuration["host"],
                        port=configuration["port"],
                    ),
                }
            )
        return steps

    try:
        steps = asyncio.run(execute())
    finally:
        client_module.AsyncModbusTcpClient = original_factory
        client_module.asyncio.sleep = original_sleep
    harness.assert_consumed()
    return {
        "name": name,
        "configuration": configuration,
        "transport_responses": [
            _write_script_contract(
                script,
                host=configuration["host"],
                port=configuration["port"],
            )
            for script in harness.scripts
        ],
        "clock": harness.clock,
        "operation": {"kind": "sequence", "actions": [dict(action) for action in actions]},
        "expected_result": {"steps": steps},
        "expected_requests": harness.events,
        "expected_state": _write_state(
            client,
            harness,
            host=configuration["host"],
            port=configuration["port"],
        ),
    }


def _write_fixture(manifest: Mapping[str, Any], client_module: Any, constants: Any, registers: Any) -> dict[str, Any]:
    custom_float = _write_custom_register("synthetic_float", 4200, "FLOAT")
    custom_bool = _write_custom_register("synthetic_bool", 4202, "BOOL")
    custom_int = _write_custom_register("synthetic_int", 4203, "INT16", minVal=-10, maxVal=10)
    custom_bitflag = _write_custom_register("synthetic_bitflag", 4204, "BITFLAG")
    custom_read_only = _write_custom_register("synthetic_read_only", 4205, "UCHAR", writable=False)
    custom_eeprom = _write_custom_register(
        "synthetic_eeprom", 4206, "UCHAR", eepromSensitive=True, minVal=0, maxVal=10
    )
    custom_eeprom_other = _write_custom_register(
        "synthetic_eeprom_other", 4207, "UCHAR", eepromSensitive=True, minVal=0, maxVal=10
    )
    custom_cyclic = _write_custom_register("synthetic_cyclic", 4208, "FLOAT", cyclicRequired=True)
    custom_cyclic_ttl = _write_custom_register(
        "synthetic_cyclic_ttl", 4210, "FLOAT", cyclicRequired=True, cyclicWriteTtl=30
    )
    custom_enum = _write_custom_register(
        "synthetic_enum",
        4212,
        "UCHAR",
        minVal=0,
        maxVal=5,
        enumOptions={"0": "Off", "1": "On"},
        excludeFromWrite=[5],
    )
    custom_write_only = _write_custom_register(
        "synthetic_write_only", 4213, "UCHAR", writeOnly=True
    )
    wrong_address = _write_custom_register("system_mode", 4214, "UCHAR")

    def simulate(register: Any, value: Any, *, dry_run: bool = True, custom: bool = False) -> dict[str, Any]:
        return {
            "allowCustomRegister": custom,
            "dryRun": dry_run,
            "kind": "simulate_write",
            "register": register,
            "value": value,
        }

    def write(register: Any, value: Any, *, custom: bool = False) -> dict[str, Any]:
        return {
            "allowCustomRegister": custom,
            "kind": "write_register",
            "register": register,
            "value": value,
        }

    ack = lambda: {"kind": "ack"}
    modbus_error = lambda: {
        "kind": "error",
        "source": "other_modbus_exception",
        "message": "write at example.invalid:502 failed",
    }
    timeout_error = lambda: {
        "kind": "error",
        "source": "timeout_exception",
        "message": "timeout at [example.invalid]:502",
    }
    reconnect_error = lambda source: {
        "kind": "error",
        "source": source,
        "message": f"{source} at example.invalid:502",
    }

    cases: list[dict[str, Any]] = []
    add = lambda **kwargs: cases.append(
        _write_scenario(client_module, registers, **kwargs)
    )

    add(name="simulate_one_word_default", actions=[simulate("system_mode", 1)])
    add(name="simulate_float_low_word_first", actions=[simulate("glt_temp_demand_heating", 42.5)])
    add(name="simulate_dry_run_false_no_traffic", actions=[simulate("system_mode", 1, dry_run=False)])
    add(
        name="set_value_dry_run_no_traffic",
        actions=[{"dryRun": True, "key": "system_mode", "kind": "set_value", "value": 1}],
    )
    add(name="write_custom_identity_no_model", actions=[simulate(custom_float, 42.5)])
    add(
        name="write_validation_unknown_key",
        actions=[simulate("not_a_register", 1)],
        validation_codes=["write_unknown_register"],
    )
    add(
        name="write_validation_read_only",
        actions=[simulate(custom_read_only, 1, custom=True)],
        validation_codes=["write_read_only"],
    )
    add(
        name="write_validation_model_unavailable",
        actions=[simulate(custom_float, 42.5)],
        validation_codes=["write_model_unavailable"],
        detected_model=constants.MODEL_NAVIGATOR_20,
    )
    add(
        name="write_validation_custom_bypass",
        actions=[simulate(custom_float, 42.5, custom=True)],
        detected_model=constants.MODEL_NAVIGATOR_20,
    )
    add(
        name="write_validation_custom_bypass_keeps_read_only",
        actions=[simulate(custom_read_only, 1, custom=True)],
        validation_codes=["write_read_only"],
        detected_model=constants.MODEL_NAVIGATOR_20,
    )
    add(
        name="write_validation_same_name_wrong_address",
        actions=[simulate(wrong_address, 1)],
        validation_codes=["write_model_unavailable"],
        detected_model=constants.MODEL_NAVIGATOR_20,
    )
    add(
        name="write_validation_canonical_model_available",
        actions=[simulate("system_mode", 1)],
        detected_model=constants.MODEL_NAVIGATOR_20,
    )
    for suffix, value in (("true", True), ("false", False), ("zero", 0), ("one", 1)):
        add(name=f"write_boolean_{suffix}", actions=[simulate(custom_bool, value)])
    add(
        name="write_validation_boolean_required",
        actions=[simulate(custom_bool, 2)],
        validation_codes=["write_boolean_required"],
    )
    add(
        name="write_validation_boolean_for_numeric",
        actions=[simulate(custom_float, True)],
        validation_codes=["write_boolean_for_numeric"],
    )
    add(
        name="write_validation_not_numeric",
        actions=[simulate(custom_float, "not-numeric")],
        validation_codes=["write_not_numeric"],
    )
    for suffix, value in (("nan", float("nan")), ("positive_infinity", float("inf")), ("negative_infinity", float("-inf"))):
        add(
            name=f"write_validation_nonfinite_{suffix}",
            actions=[simulate(custom_float, value)],
            validation_codes=["write_nonfinite"],
        )
    add(
        name="write_validation_integer_required",
        actions=[simulate(custom_int, 1.5)],
        validation_codes=["write_integer_required"],
    )
    add(
        name="write_validation_excluded_precedence",
        actions=[simulate(custom_enum, 5)],
        validation_codes=["write_excluded"],
    )
    add(
        name="write_validation_below_minimum",
        actions=[simulate(custom_int, -11)],
        validation_codes=["write_below_minimum"],
    )
    add(
        name="write_validation_above_maximum",
        actions=[simulate(custom_int, 11)],
        validation_codes=["write_above_maximum"],
    )
    add(
        name="write_validation_enum_unsupported",
        actions=[simulate(custom_enum, 3)],
        validation_codes=["write_enum_unsupported"],
    )
    add(name="write_validation_bitflag_codec", actions=[simulate(custom_bitflag, 255)])
    add(name="write_validation_write_only", actions=[simulate(custom_write_only, 1)])
    add(name="write_fc16_one_word", actions=[write("system_mode", 1)], scripts=[ack()])
    add(name="write_fc16_bool_one_word", actions=[write(custom_bool, True)], scripts=[ack()])
    add(name="write_fc16_int_one_word", actions=[write(custom_int, -10)], scripts=[ack()])
    add(name="write_fc16_float_low_word_first", actions=[write(custom_float, 42.5)], scripts=[ack()])
    add(
        name="eeprom_immediate_throttle",
        actions=[write(custom_eeprom, 1), write(custom_eeprom, 2)],
        scripts=[ack()],
        validation_codes=[None, "write_eeprom_throttled"],
    )
    add(
        name="eeprom_exact_60_second_boundary",
        actions=[
            write(custom_eeprom, 1),
            {"kind": "advance_time", "seconds": 59.999},
            write(custom_eeprom, 2),
            {"kind": "advance_time", "seconds": 0.001},
            write(custom_eeprom, 3),
        ],
        scripts=[ack(), ack()],
        validation_codes=[None, None, "write_eeprom_throttled", None, None],
    )
    add(
        name="eeprom_reset_scopes",
        actions=[
            write(custom_eeprom, 1),
            write(custom_eeprom_other, 1),
            {"kind": "reset_write_throttle", "register": custom_eeprom},
            write(custom_eeprom, 2),
            {"kind": "reset_write_throttle"},
            write(custom_eeprom_other, 2),
        ],
        scripts=[ack(), ack(), ack(), ack()],
    )
    add(
        name="cyclic_default_ttl_boundary",
        actions=[
            write(custom_cyclic, 20.0),
            {"kind": "get_active_cyclic_writes"},
            {"kind": "advance_time", "seconds": 299.999},
            {"kind": "get_active_cyclic_writes"},
            {"kind": "advance_time", "seconds": 0.001},
            {"kind": "get_expired_cyclic_writes"},
        ],
        scripts=[ack()],
    )
    add(
        name="cyclic_custom_ttl_refresh_and_resets",
        actions=[
            write(custom_cyclic_ttl, 20.0),
            {"kind": "advance_time", "seconds": 10},
            write(custom_cyclic_ttl, 21.0),
            {"kind": "reset_cyclic_write_state", "register": custom_cyclic_ttl},
            write(custom_cyclic, 22.0),
            {"kind": "reset_cyclic_write_state"},
        ],
        scripts=[ack(), ack(), ack()],
    )
    add(
        name="write_retry_modbus_eventual_success",
        actions=[write(custom_float, 42.5)],
        scripts=[modbus_error(), ack()],
    )
    add(
        name="write_retry_code_2_is_modbus",
        actions=[write(custom_float, 42.5)],
        scripts=[
            {"kind": "error", "source": "numeric_modbus_exception_code_2", "message": "code 2"},
            ack(),
        ],
    )
    add(
        name="write_retry_transport_reconnect",
        actions=[write(custom_float, 42.5)],
        scripts=[timeout_error(), ack()],
    )
    for suffix, source in (
        ("disconnected", "connection_exception"),
        ("socket", "socket_or_os_error"),
        ("no_response", "modbus_io_exception_or_structured_no_response"),
    ):
        add(
            name=f"write_retry_{suffix}_reconnect",
            actions=[write(custom_float, 42.5)],
            scripts=[reconnect_error(source), ack()],
        )
    add(
        name="write_retry_exhaustion_rollback",
        actions=[write(custom_eeprom, 1)],
        scripts=[modbus_error(), modbus_error(), modbus_error()],
    )
    add(
        name="write_failed_cyclic_refresh_preserves_deadline",
        actions=[write(custom_cyclic_ttl, 20.0), {"kind": "advance_time", "seconds": 10}, write(custom_cyclic_ttl, 21.0)],
        scripts=[ack(), modbus_error(), modbus_error(), modbus_error()],
    )
    add(
        name="write_failed_first_cyclic_has_no_deadline",
        actions=[write(custom_cyclic_ttl, 20.0)],
        scripts=[modbus_error(), modbus_error(), modbus_error()],
    )
    add(
        name="write_diagnostics_redacted_and_last_error_retained",
        actions=[write(custom_float, 42.5), write(custom_float, 43.0)],
        scripts=[modbus_error(), ack(), ack()],
    )
    add(
        name="write_fifo_ordering",
        actions=[write(custom_eeprom, 1), write(custom_eeprom, 2)],
        scripts=[ack()],
        validation_codes=[None, "write_eeprom_throttled"],
    )

    names = [case["name"] for case in cases]
    if len(names) != len(set(names)) or len(cases) < 26:
        fail("fixture_invalid", "write scenario inventory must be complete and unique")
    return _fixture_root(manifest, operation_kinds=list(WRITE_ACTION_KINDS), scenarios=cases)


def generate_fixtures(manifest: Mapping[str, Any], checkout: Path) -> dict[Path, bytes]:
    # This is the first upstream execution point. Every caller reaches it only
    # after ``verify_checkout`` and output-root validation have succeeded.
    sys.path.insert(0, os.fspath(checkout))
    try:
        import idm_heatpump  # type: ignore[import-not-found]
        from idm_heatpump import client as client_module  # type: ignore[import-not-found]
        from idm_heatpump import const as constants  # type: ignore[import-not-found]
        from idm_heatpump import registers  # type: ignore[import-not-found]

        public_api, public_classes = _public_fixtures(manifest, checkout, idm_heatpump)
        fixtures = {
            OUTPUT_PATHS[0]: public_api,
            OUTPUT_PATHS[1]: public_classes,
            OUTPUT_PATHS[2]: _codec_fixture(manifest, client_module),
            OUTPUT_PATHS[3]: _register_fixture(manifest, checkout, client_module, constants, registers),
            OUTPUT_PATHS[4]: _behavior_fixture(manifest, client_module, registers),
            OUTPUT_PATHS[5]: _fixture_root(
                manifest,
                evidence_kind="deferred_marker",
                deferred_to_phase=4,
                release_blocking=True,
                reason="Navigator 10 WebSocket and Navigator 2.0 HTTP parity require Phase 4 executable evidence",
                scenarios=[],
            ),
            OUTPUT_PATHS[6]: _transport_fixture(
                manifest,
                client_module,
                constants,
                registers,
            ),
            OUTPUT_PATHS[7]: _write_fixture(
                manifest,
                client_module,
                constants,
                registers,
            ),
        }
        return {path: canonical_json_bytes(value) for path, value in fixtures.items()}
    finally:
        try:
            sys.path.remove(os.fspath(checkout))
        except ValueError:
            pass


def write_fixtures(artifacts: Mapping[Path, bytes], output_root: Path) -> None:
    if set(artifacts) != set(OUTPUT_PATHS):
        fail("fixture_invalid", "generator did not produce the exact output allowlist")
    fixture_directory = output_root / "test" / "fixtures"
    fixture_directory.mkdir(parents=True, exist_ok=True)
    try:
        if fixture_directory.resolve(strict=True).parent.parent != output_root.resolve(strict=True):
            fail("invalid_output_root", "fixture directory escapes the approved output root")
    except OSError as error:
        fail("invalid_output_root", str(error))

    transaction_root = Path(
        tempfile.mkdtemp(prefix=".idm-contract-transaction-", dir=fixture_directory)
    )
    staged_root = transaction_root / "staged"
    backup_root = transaction_root / "backup"
    staged_root.mkdir()
    backup_root.mkdir()
    replaced: list[tuple[Path, Path | None]] = []
    try:
        for relative_path in OUTPUT_PATHS:
            staged = staged_root / relative_path.name
            with staged.open("wb") as stream:
                stream.write(artifacts[relative_path])
                stream.flush()
                os.fsync(stream.fileno())
            if staged.read_bytes() != artifacts[relative_path]:
                fail("fixture_invalid", f"staged artifact verification failed: {relative_path}")
            try:
                validate_contract_value(json.loads(staged.read_text(encoding="utf-8")))
            except (UnicodeError, json.JSONDecodeError) as error:
                fail("fixture_invalid", f"staged artifact is not canonical JSON: {error}")

        if os.environ.get("IDM_CONTRACT_TEST_FAIL_AFTER_STAGE") == "1":
            fail("injected_failure", "test-only failure after all artifacts were staged")

        for relative_path in OUTPUT_PATHS:
            destination = output_root / relative_path
            staged = staged_root / relative_path.name
            backup: Path | None = None
            if destination.exists():
                backup = backup_root / relative_path.name
                os.replace(destination, backup)
            try:
                os.replace(staged, destination)
            except BaseException:
                if backup is not None and backup.exists():
                    os.replace(backup, destination)
                raise
            replaced.append((destination, backup))
            failure_after_replace = os.environ.get(
                "IDM_CONTRACT_TEST_FAIL_AFTER_REPLACE"
            )
            if failure_after_replace == str(len(replaced)):
                fail(
                    "injected_failure",
                    f"test-only failure after replacing {len(replaced)} artifact(s)",
                )
    except BaseException:
        for destination, backup in reversed(replaced):
            try:
                if destination.exists():
                    destination.unlink()
                if backup is not None and backup.exists():
                    os.replace(backup, destination)
            except OSError:
                # Preserve the original exception; a rollback failure remains a
                # hard generator failure and cannot be reported as success.
                pass
        raise
    finally:
        shutil.rmtree(transaction_root, ignore_errors=True)


def check_fixtures(artifacts: Mapping[Path, bytes], comparison_root: Path) -> None:
    if set(artifacts) != set(OUTPUT_PATHS):
        fail("fixture_invalid", "generator did not produce the exact output allowlist")
    with tempfile.TemporaryDirectory(prefix="idm-heatpump-contract-check-") as temporary:
        generated_root = Path(temporary)
        for relative_path in OUTPUT_PATHS:
            generated = generated_root / relative_path
            generated.parent.mkdir(parents=True, exist_ok=True)
            generated.write_bytes(artifacts[relative_path])

        for relative_path in OUTPUT_PATHS:
            committed = comparison_root / relative_path
            generated = generated_root / relative_path
            if not committed.is_file():
                fail("contract_drift", f"{relative_path.as_posix()}: missing committed artifact")
            committed_bytes = committed.read_bytes()
            generated_bytes = generated.read_bytes()
            if committed_bytes == generated_bytes:
                continue
            difference_kind = "byte difference"
            try:
                if json.loads(committed_bytes) != json.loads(generated_bytes):
                    difference_kind = "semantic difference"
            except (UnicodeError, json.JSONDecodeError):
                difference_kind = "semantic difference (committed artifact is invalid JSON)"
            fail("contract_drift", f"{relative_path.as_posix()}: {difference_kind}")


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

    artifacts = generate_fixtures(manifest, checkout)
    if args.check:
        check_fixtures(artifacts, output_root)
        print(f"Verified {len(artifacts)} pinned semantic fixtures at {output_root}")
        return 0
    write_fixtures(artifacts, output_root)
    print(f"Generated {len(artifacts)} pinned semantic fixtures at {output_root}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ContractError as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(1) from None
