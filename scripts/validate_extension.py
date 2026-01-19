#!/usr/bin/env python3
import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "manifest.json"


def is_static_resource(resource):
    return not any(char in resource for char in ["*", "?", "[", "]", "{", "}", "<", ">"])


def require_file(relative_path, label, errors):
    if not relative_path:
        errors.append(f"{label} is empty.")
        return
    path = ROOT / relative_path
    if not path.is_file():
        errors.append(f"{label} not found: {relative_path}.")


def main():
    errors = []
    warnings = []

    if not MANIFEST_PATH.is_file():
        print("ERROR: manifest.json not found.")
        return 1

    try:
        manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exc:
        print(f"ERROR: Failed to read manifest.json: {exc}")
        return 1

    manifest_version = manifest.get("manifest_version")
    if manifest_version != 3:
        errors.append(f"manifest_version must be 3 (found: {manifest_version}).")

    for field in ["name", "version", "description"]:
        value = manifest.get(field)
        if not isinstance(value, str) or not value.strip():
            errors.append(f"{field} must be a non-empty string.")

    if isinstance(manifest.get("version"), str):
        if not re.match(r"^\d+\.\d+\.\d+$", manifest["version"]):
            warnings.append("version does not match x.y.z format.")

    action = manifest.get("action") or {}
    popup = action.get("default_popup")
    if popup:
        require_file(popup, "action.default_popup", errors)
    else:
        warnings.append("action.default_popup is not set.")

    background = manifest.get("background") or {}
    service_worker = background.get("service_worker")
    if service_worker:
        require_file(service_worker, "background.service_worker", errors)
    else:
        errors.append("background.service_worker is required.")

    content_scripts = manifest.get("content_scripts") or []
    if not isinstance(content_scripts, list) or not content_scripts:
        errors.append("content_scripts must be a non-empty list.")
    else:
        for index, entry in enumerate(content_scripts):
            if not isinstance(entry, dict):
                errors.append(f"content_scripts[{index}] must be an object.")
                continue
            for key in ("js", "css"):
                files = entry.get(key) or []
                if not isinstance(files, list):
                    errors.append(f"content_scripts[{index}].{key} must be a list.")
                    continue
                for file_path in files:
                    require_file(file_path, f"content_scripts[{index}].{key}", errors)

    web_resources = manifest.get("web_accessible_resources") or []
    if not isinstance(web_resources, list):
        errors.append("web_accessible_resources must be a list.")
    else:
        for index, entry in enumerate(web_resources):
            if not isinstance(entry, dict):
                errors.append(f"web_accessible_resources[{index}] must be an object.")
                continue
            resources = entry.get("resources") or []
            if not isinstance(resources, list):
                errors.append(f"web_accessible_resources[{index}].resources must be a list.")
                continue
            for resource in resources:
                if not isinstance(resource, str):
                    errors.append(f"web_accessible_resources[{index}] contains a non-string entry.")
                    continue
                if is_static_resource(resource):
                    require_file(resource, "web_accessible_resources", errors)
                else:
                    warnings.append(
                        f"web_accessible_resources entry skipped (pattern): {resource}."
                    )

    if errors:
        print("Validation failed with errors:")
        for error in errors:
            print(f"- {error}")
        if warnings:
            print("Warnings:")
            for warning in warnings:
                print(f"- {warning}")
        return 1

    print("Validation passed.")
    if warnings:
        print("Warnings:")
        for warning in warnings:
            print(f"- {warning}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
