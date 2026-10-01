#!/usr/bin/env python3
"""Gauntlet Experiment Harness.

Provides repeatable isolation, preparation, output saving, and validation
for the Slopanoid Gauntlet retro game benchmark experiments.
"""

from __future__ import annotations

import argparse
import os
import re
import stat
import sys
from pathlib import Path
from typing import NamedTuple

REPO_ROOT = Path(__file__).resolve().parent.parent
SIMPLE_PROMPT_DIR = REPO_ROOT / "simple-prompt"
GAUNTLET_DIR = REPO_ROOT / "gauntlet"


class ValidationResult(NamedTuple):
    passed: bool
    issues: list[str]
    metrics: dict[str, int | str | bool]


def isolate_repository() -> None:
    """Enforce physical read-isolation on simple-prompt directory."""
    if not SIMPLE_PROMPT_DIR.exists():
        print(f"[ISOLATE] Warning: {SIMPLE_PROMPT_DIR} does not exist.")
        return
    print(f"[ISOLATE] Locking down {SIMPLE_PROMPT_DIR} (chmod 000)...")
    try:
        os.chmod(SIMPLE_PROMPT_DIR, 0)
        print("[ISOLATE] Successfully isolated repository code. Access blocked.")
    except OSError as err:
        print(
            f"[ISOLATE ERROR] Failed to lock down {SIMPLE_PROMPT_DIR}: {err}. "
            "Ensure the current user owns the directory.",
            file=sys.stderr,
        )
        raise


def restore_repository() -> None:
    """Restore normal read-execute permissions on simple-prompt directory."""
    if not SIMPLE_PROMPT_DIR.exists():
        return
    print(f"[RESTORE] Restoring permissions on {SIMPLE_PROMPT_DIR}...")
    try:
        # User rwx, group rx, others none
        os.chmod(SIMPLE_PROMPT_DIR, stat.S_IRWXU | stat.S_IRGRP | stat.S_IXGRP)
        print("[RESTORE] Successfully restored repository code access.")
    except OSError as err:
        print(
            f"[RESTORE ERROR] Failed to restore permissions on {SIMPLE_PROMPT_DIR}: {err}",
            file=sys.stderr,
        )
        raise


def read_prompt(prompt_path: Path) -> str:
    """Read and validate the benchmark prompt file."""
    resolved = prompt_path.resolve()
    if not resolved.exists():
        raise FileNotFoundError(
            f"Prompt file not found at '{prompt_path}'. "
            f"Verify the path exists within '{GAUNTLET_DIR}'."
        )
    content = resolved.read_text(encoding="utf-8")
    if not content.strip():
        raise ValueError(f"Prompt file at '{prompt_path}' is empty.")
    return content


def validate_game_html(html_path: Path) -> ValidationResult:
    """Audit single-file HTML output against Gauntlet constraints."""
    resolved = html_path.resolve()
    if not resolved.exists():
        return ValidationResult(
            passed=False,
            issues=[f"Target HTML file '{html_path}' does not exist."],
            metrics={},
        )

    content = resolved.read_text(encoding="utf-8")
    issues: list[str] = []
    metrics: dict[str, int | str | bool] = {}

    file_size_bytes = len(content.encode("utf-8"))
    metrics["file_size_kb"] = round(file_size_bytes / 1024, 1)

    # 1. External dependencies check
    external_scripts = re.findall(r'<script[^>]+src=["\']([^"\']+)["\']', content, re.I)
    external_styles = re.findall(r'<link[^>]+rel=["\']stylesheet["\'][^>]+href=["\']([^"\']+)["\']', content, re.I)
    external_images = re.findall(r'<img[^>]+src=["\'](?!data:)([^"\']+)["\']', content, re.I)

    if external_scripts:
        issues.append(f"External script sources detected (violates zero-external-libraries): {external_scripts}")
    if external_styles:
        issues.append(f"External stylesheet links detected: {external_styles}")
    if external_images:
        issues.append(f"External image sources detected (violates zero-external-assets): {external_images}")

    metrics["has_external_assets"] = bool(external_scripts or external_styles or external_images)

    # 2. Canvas verification
    has_canvas = bool(re.search(r"<canvas", content, re.I))
    metrics["has_canvas"] = has_canvas
    if not has_canvas:
        issues.append("No <canvas> element found in HTML.")

    # 3. Web Audio API / FM Synthesizer check
    has_audio_ctx = bool(re.search(r"(AudioContext|webkitAudioContext)", content))
    has_oscillator = bool(re.search(r"createOscillator", content))
    has_gain = bool(re.search(r"createGain", content))
    metrics["web_audio_present"] = has_audio_ctx and has_oscillator and has_gain
    if not (has_audio_ctx and has_oscillator):
        issues.append("Web Audio API synthesizer (AudioContext / createOscillator) not found.")

    # 4. Check level arrays or matrices
    # Expecting 33 levels according to prompt
    level_matches = re.findall(r"level\s*\d+|levels\s*\[\s*\d+\s*\]|levelData|levelMaps", content, re.I)
    metrics["level_references_count"] = len(level_matches)

    passed = len(issues) == 0
    return ValidationResult(passed=passed, issues=issues, metrics=metrics)


def save_golden_master(prompt_path: Path, html_content: str) -> Path:
    """Save the final golden master HTML file alongside the prompt."""
    prompt_dir = prompt_path.resolve().parent
    output_path = prompt_dir / "index.html"

    # Extract HTML block if markdown code fences are present
    match = re.search(r"```html\s*(.*?)\s*```", html_content, re.DOTALL | re.IGNORECASE)
    clean_code = match.group(1).strip() if match else html_content.strip()

    output_path.write_text(clean_code, encoding="utf-8")
    print(f"[SAVE] Golden master written to: {output_path} ({len(clean_code.encode('utf-8'))} bytes)")
    return output_path


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Slopanoid Gauntlet Experiment Harness",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 scripts/gauntlet_harness.py isolate
  python3 scripts/gauntlet_harness.py restore
  python3 scripts/gauntlet_harness.py validate gauntlet/gemini-3.8/arkanoid/index.html
  python3 scripts/gauntlet_harness.py prepare gauntlet/gemini-3.8/arkanoid/PROMPT.md
        """,
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    # isolate
    subparsers.add_parser("isolate", help="Lock down simple-prompt to isolate baseline code.")

    # restore
    subparsers.add_parser("restore", help="Restore normal permissions on simple-prompt.")

    # prepare
    prep_parser = subparsers.add_parser("prepare", help="Read prompt and prepare for execution.")
    prep_parser.add_argument("prompt_path", type=Path, help="Path to PROMPT.md")

    # validate
    val_parser = subparsers.add_parser("validate", help="Validate generated game HTML against rules.")
    val_parser.add_argument("html_path", type=Path, help="Path to index.html")

    # save
    save_parser = subparsers.add_parser("save", help="Save code content to index.html next to PROMPT.md")
    save_parser.add_argument("prompt_path", type=Path, help="Path to PROMPT.md")
    save_parser.add_argument("--code-file", type=Path, required=True, help="File containing raw HTML/code")

    args = parser.parse_args()

    if args.command == "isolate":
        isolate_repository()
    elif args.command == "restore":
        restore_repository()
    elif args.command == "prepare":
        prompt_text = read_prompt(args.prompt_path)
        isolate_repository()
        print(f"[PREPARE] Prompt '{args.prompt_path}' loaded ({len(prompt_text)} chars).")
        print("[PREPARE] Environment isolated. Ready for subagent invocation.")
    elif args.command == "validate":
        res = validate_game_html(args.html_path)
        print(f"Validation Result: {'PASSED ✅' if res.passed else 'FAILED ❌'}")
        print(f"Metrics: {res.metrics}")
        if res.issues:
            print("Issues:")
            for issue in res.issues:
                print(f"  - {issue}")
        sys.exit(0 if res.passed else 1)
    elif args.command == "save":
        code = args.code_file.read_text(encoding="utf-8")
        out = save_golden_master(args.prompt_path, code)
        restore_repository()
        res = validate_game_html(out)
        print(f"Post-Save Validation: {'PASSED ✅' if res.passed else 'FAILED ❌'}")
        if not res.passed:
            print(f"Issues: {res.issues}")


if __name__ == "__main__":
    main()
