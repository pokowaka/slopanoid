#!/usr/bin/env python3
"""Air-gapped Clean-Room Benchmark Harness for Slopanoid.

Stages canonical PROMPT.md files into a clean non-git /tmp directory, locks down
the slopanoid repository root (blocking both working-tree files and .git object
history), validates generated builds, collects outputs back into the repo, and
optionally extracts conversation token/wall-time metrics via usage_report.py.

Because locking the repository root (`chmod 000`) blocks executing scripts inside
`slopanoid/scripts/` until unlocked, `prepare` automatically installs a copy of
this harness and lock metadata into `~/.cache/slopanoid/cleanroom_harness.py`.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import sys
import tempfile
from typing import Any

GAMES: tuple[str, ...] = ("arkanoid", "xenon2", "ghosts-n-goblins", "lemmings")
BASELINE_MODELS: tuple[str, ...] = ("opus-5.5", "gemini-3.8", "fable-5.1")
STAGING_ROOT = Path("/var/tmp")  # Persists across macOS midnight /tmp cleanups
CONTROL_DIR = Path.home() / ".cache" / "slopanoid"
STATE_FILE = CONTROL_DIR / "state.json"
CONTROL_SCRIPT = CONTROL_DIR / "cleanroom_harness.py"


def load_state() -> dict[str, Any]:
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return {}
    return {}


def save_state(state: dict[str, Any]) -> None:
    CONTROL_DIR.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")


def resolve_repo_root(explicit: Path | None = None) -> Path:
    if explicit is not None:
        return explicit.expanduser().resolve()
    script_path = Path(__file__).resolve()
    if script_path.parent.name == "scripts":
        return script_path.parent.parent
    state = load_state()
    if "repo_root" in state:
        return Path(state["repo_root"])
    raise RuntimeError(
        "Could not determine slopanoid repository root. Pass --repo-root explicitly."
    )


def is_repo_locked(repo_root: Path) -> bool:
    try:
        st = os.stat(repo_root)
    except OSError:
        return True
    mode = stat.S_IMODE(st.st_mode)
    if mode == 0:
        return True
    if st.st_uid == 0 and os.geteuid() != 0 and (mode & 0o005) == 0:
        return True
    try:
        os.listdir(repo_root)
        return False
    except PermissionError:
        return True


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify_canonical_prompts(repo_root: Path, model: str) -> dict[str, str]:
    """Ensure simple-prompt/<model>/<game>/PROMPT.md matches opus-5.5 byte-for-byte."""
    model_dir = repo_root / "simple-prompt" / model
    baseline_dir = repo_root / "simple-prompt" / "opus-5.5"
    if not model_dir.is_dir():
        raise FileNotFoundError(
            f"Model directory not found: {model_dir}. Create scaffolding first."
        )
    hashes: dict[str, str] = {}
    for game in GAMES:
        prompt_path = model_dir / game / "PROMPT.md"
        ref_path = baseline_dir / game / "PROMPT.md"
        if not prompt_path.is_file():
            raise FileNotFoundError(f"Missing prompt file: {prompt_path}")
        h = sha256_file(prompt_path)
        if ref_path.is_file():
            ref_h = sha256_file(ref_path)
            if h != ref_h:
                raise ValueError(
                    f"Prompt hash mismatch for {model}/{game}/PROMPT.md "
                    f"({h[:12]} != opus-5.5 {ref_h[:12]})."
                )
        hashes[game] = h
    return hashes


def write_run_guide(model: str, staging_dir: Path) -> Path:
    """Write ready-to-paste clean-room prompts outside the /tmp staging directory."""
    CONTROL_DIR.mkdir(parents=True, exist_ok=True)
    guide_path = CONTROL_DIR / f"{model}-run-guide.md"
    guide = f"""# Clean-Room Execution Guide: `{model}`

Staging workspace (contains **only** `PROMPT.md` per game, zero `.git` history):
`{staging_dir}`

## 1. Open Isolated Workspace
1. Close any window opened on `slopanoid`.
2. Open `{staging_dir}` as the workspace root (or open `{staging_dir}/<game>` per game).

## 2A. Option A — Direct Single-Game Prompt (1 conversation per game)
Select **{model}** in the model picker and send:

```text
Read {staging_dir}/<game>/PROMPT.md and build the complete, self-contained game into {staging_dir}/<game>/index.html following every requirement in PROMPT.md. Do not read or write anything outside {staging_dir}/<game>/. Verify your JavaScript syntax with `node --check` before finishing.
```

## 2B. Option B — 4-Game Parallel Swarm (from `{staging_dir}`)
Spawn 4 parallel workers pinned to `{model}`, one per game folder (`arkanoid`, `xenon2`, `ghosts-n-goblins`, `lemmings`), giving each worker strict instructions to read only `<game>/PROMPT.md` and write its completed build inside `{staging_dir}/<game>/`.

## 3. Unlock, Collect & Validate After Run Completes
```bash
python3 {CONTROL_SCRIPT} collect {model}
# Optionally pass conversation IDs to generate simple-prompt/metrics/{model}.json:
python3 {CONTROL_SCRIPT} collect {model} --convs <conv-arkanoid> <conv-xenon2> <conv-gng> <conv-lemmings>
```
"""
    guide_path.write_text(guide, encoding="utf-8")
    return guide_path


def install_control_script() -> None:
    CONTROL_DIR.mkdir(parents=True, exist_ok=True)
    src = Path(__file__).resolve()
    if src != CONTROL_SCRIPT.resolve():
        shutil.copy2(src, CONTROL_SCRIPT)
        CONTROL_SCRIPT.chmod(0o755)


def lock_repository(repo_root: Path, sudo_lock: bool, state: dict[str, Any]) -> None:
    if is_repo_locked(repo_root):
        print(f"[LOCK] {repo_root} is already locked.")
        return

    st = os.stat(repo_root)
    state["orig_mode"] = stat.S_IMODE(st.st_mode)
    state["orig_uid"] = st.st_uid
    state["orig_gid"] = st.st_gid
    state["sudo_lock"] = bool(sudo_lock)
    state["locked_at"] = datetime.now(timezone.utc).isoformat()
    save_state(state)

    if sudo_lock:
        print(f"[LOCK] Kernel-locking {repo_root} via sudo (root:wheel, mode 0700)...")
        subprocess.run(["sudo", "chown", "root:wheel", str(repo_root)], check=True)
        subprocess.run(["sudo", "chmod", "700", str(repo_root)], check=True)
    else:
        print(f"[LOCK] Locking {repo_root} (chmod 000 — blocks working tree & .git)...")
        os.chmod(repo_root, 0)

    if not is_repo_locked(repo_root):
        raise RuntimeError(f"Failed to verify lock on {repo_root}.")
    print(f"[LOCK] Verified: {repo_root} (including .git/) is unreadable.")


def unlock_repository(repo_root: Path, state: dict[str, Any]) -> None:
    if not is_repo_locked(repo_root):
        print(f"[UNLOCK] {repo_root} is already unlocked.")
        return

    orig_mode = int(state.get("orig_mode", 0o755))
    orig_uid = int(state.get("orig_uid", os.getuid()))
    orig_gid = int(state.get("orig_gid", os.getgid()))
    sudo_lock = bool(state.get("sudo_lock", False))

    try:
        st = os.stat(repo_root)
        needs_sudo = sudo_lock or (st.st_uid != os.geteuid() and os.geteuid() != 0)
    except OSError:
        needs_sudo = sudo_lock

    if needs_sudo:
        print(f"[UNLOCK] Restoring ownership & permissions on {repo_root} via sudo...")
        subprocess.run(
            ["sudo", "chown", f"{orig_uid}:{orig_gid}", str(repo_root)], check=True
        )
        subprocess.run(["sudo", "chmod", f"{orig_mode:o}", str(repo_root)], check=True)
    else:
        print(f"[UNLOCK] Restoring permissions (0{orig_mode:o}) on {repo_root}...")
        os.chmod(repo_root, orig_mode)

    state["locked_at"] = None
    state["sudo_lock"] = False
    save_state(state)
    print(f"[UNLOCK] Restored access to {repo_root}.")


def check_js_syntax(code: str, is_module: bool = False) -> str | None:
    """Run `node --check` on a JS snippet; return error message or None."""
    if shutil.which("node") is None:
        return None
    suffix = ".mjs" if is_module else ".js"
    with tempfile.NamedTemporaryFile(
        "w", suffix=suffix, encoding="utf-8", delete=False
    ) as tmp:
        tmp.write(code)
        tmp_path = Path(tmp.name)
    try:
        proc = subprocess.run(
            ["node", "--check", str(tmp_path)],
            capture_output=True,
            text=True,
            timeout=15,
        )
        if proc.returncode != 0:
            err = (proc.stderr or proc.stdout).strip().splitlines()
            return err[0] if err else "node --check failed"
        return None
    finally:
        tmp_path.unlink(missing_ok=True)


def nontrivial_lines(paths: list[Path]) -> set[str]:
    out: set[str] = set()
    ignore_prefixes = ("//", "/*", "*", "<!--", "-->", "<!DOCTYPE", "<meta", "<html", "</")
    for p in paths:
        for raw in p.read_text(encoding="utf-8", errors="replace").splitlines():
            s = raw.strip()
            if len(s) < 28 or s.startswith(ignore_prefixes):
                continue
            out.add(s)
    return out


def collect_runtime_files(game_dir: Path) -> tuple[list[Path], list[str]]:
    """Return (runtime_files, issues) for a single game directory."""
    issues: list[str] = []
    html_path = game_dir / "index.html"
    if not html_path.is_file():
        return [], ["Missing index.html"]

    html = html_path.read_text(encoding="utf-8", errors="replace")
    if "Scaffolding Initialized" in html:
        return [html_path], ["index.html is still the placeholder scaffolding page"]

    runtime_files: list[Path] = [html_path]
    seen: set[Path] = {html_path.resolve()}

    # Inspect <script ...> tags (both external/local src and inline blocks)
    script_tag_re = re.compile(
        r"<script\b([^>]*)>(.*?)</script>", re.IGNORECASE | re.DOTALL
    )
    for attrs, body in script_tag_re.findall(html):
        src_m = re.search(r'\bsrc\s*=\s*["\']([^"\']+)["\']', attrs, re.IGNORECASE)
        type_m = re.search(r'\btype\s*=\s*["\']([^"\']+)["\']', attrs, re.IGNORECASE)
        script_type = (type_m.group(1).strip().lower() if type_m else "")
        is_module = script_type == "module"
        is_js = script_type in ("", "text/javascript", "application/javascript", "module")

        if src_m:
            src = src_m.group(1).strip()
            if re.match(r"^(https?:)?//", src, re.IGNORECASE):
                issues.append(f"External script forbidden: {src}")
            else:
                local_js = (game_dir / src).resolve()
                if not str(local_js).startswith(str(game_dir.resolve())) or not local_js.is_file():
                    issues.append(f"Missing local script referenced in HTML: {src}")
                else:
                    if local_js not in seen:
                        seen.add(local_js)
                        runtime_files.append(local_js)
                    js_err = check_js_syntax(
                        local_js.read_text(encoding="utf-8", errors="replace"),
                        is_module=is_module,
                    )
                    if js_err:
                        issues.append(f"JS syntax error in {src}: {js_err}")
        elif is_js and body.strip():
            js_err = check_js_syntax(body, is_module=is_module)
            if js_err:
                issues.append(f"Inline <script> syntax error: {js_err}")

    # Inspect <link rel="stylesheet" href="...">
    for link_tag in re.findall(r"<link\b[^>]*>", html, re.IGNORECASE):
        if not re.search(r'\brel\s*=\s*["\']stylesheet["\']', link_tag, re.IGNORECASE):
            continue
        href_m = re.search(r'\bhref\s*=\s*["\']([^"\']+)["\']', link_tag, re.IGNORECASE)
        if not href_m:
            continue
        href = href_m.group(1).strip()
        if re.match(r"^(https?:)?//", href, re.IGNORECASE):
            issues.append(f"External stylesheet forbidden: {href}")
        else:
            local_css = (game_dir / href).resolve()
            if not str(local_css).startswith(str(game_dir.resolve())) or not local_css.is_file():
                issues.append(f"Missing local stylesheet referenced in HTML: {href}")
            elif local_css not in seen:
                seen.add(local_css)
                runtime_files.append(local_css)

    # Check external media / image / font assets across runtime files
    combined = "\n".join(
        p.read_text(encoding="utf-8", errors="replace") for p in runtime_files
    )
    ext_media = re.findall(
        r'<(?:img|audio|video|source)\b[^>]+src\s*=\s*["\'](?!data:)([^"\']+)["\']',
        html,
        re.IGNORECASE,
    )
    if ext_media:
        issues.append(f"External media/image sources forbidden: {ext_media}")

    ext_css_urls = re.findall(
        r'url\(\s*["\']?(https?://[^"\')\s]+)["\']?\s*\)', combined, re.IGNORECASE
    )
    if ext_css_urls:
        issues.append(f"External CSS url() assets forbidden: {ext_css_urls}")

    # Check Canvas & Web Audio API
    has_canvas = bool(
        re.search(r"(<canvas\b|createElement\(\s*['\"]canvas['\"]\s*\))", combined, re.I)
    )
    if not has_canvas:
        issues.append("No <canvas> element or dynamic canvas creation detected")

    has_audio = bool(
        re.search(r"\b(AudioContext|webkitAudioContext|OfflineAudioContext)\b", combined)
    )
    if not has_audio:
        issues.append("No Web Audio API (AudioContext) synthesizer detected")

    return runtime_files, issues


def validate_target_dir(
    target_dir: Path, repo_root: Path | None = None, model_name: str | None = None
) -> bool:
    """Validate all 4 games under target_dir and print a summary report."""
    print(f"\n=== Validating {target_dir} ===")
    all_passed = True
    total_bytes = 0
    total_lines = 0

    can_audit_baselines = (
        repo_root is not None
        and not is_repo_locked(repo_root)
        and (repo_root / "simple-prompt").is_dir()
    )

    for game in GAMES:
        game_dir = target_dir / game
        runtime_files, issues = collect_runtime_files(game_dir)
        g_bytes = sum(p.stat().st_size for p in runtime_files if p.is_file())
        g_lines = sum(
            len(p.read_text(encoding="utf-8", errors="replace").splitlines())
            for p in runtime_files
            if p.is_file()
        )
        total_bytes += g_bytes
        total_lines += g_lines

        overlap_note = ""
        if can_audit_baselines and runtime_files and not issues and repo_root is not None:
            cand_lines = nontrivial_lines(runtime_files)
            max_shared = 0
            max_base = ""
            for base in BASELINE_MODELS:
                if base == model_name:
                    continue
                base_dir = repo_root / "simple-prompt" / base / game
                if not base_dir.is_dir():
                    continue
                base_files, _ = collect_runtime_files(base_dir)
                if not base_files:
                    continue
                shared = len(cand_lines & nontrivial_lines(base_files))
                if shared > max_shared:
                    max_shared = shared
                    max_base = base
            overlap_note = (
                f" · clean-room overlap: {max_shared}/{len(cand_lines)} lines"
                + (f" (max vs {max_base})" if max_base else "")
            )

        status = "PASS ✅" if not issues else "FAIL ❌"
        if issues:
            all_passed = False
        kb = g_bytes / 1000
        print(
            f"  [{status}] {game:<18} {kb:6.1f} KB · {g_lines:5d} lines "
            f"({len(runtime_files)} runtime file{'s' if len(runtime_files) != 1 else ''})"
            f"{overlap_note}"
        )
        for issue in issues:
            print(f"             - {issue}")

    print(
        f"  Total runtime shipped: {total_bytes / 1000:.1f} KB · {total_lines:,} lines · "
        f"Overall: {'PASSED ✅' if all_passed else 'FAILED ❌'}"
    )
    return all_passed


def cmd_prepare(args: argparse.Namespace) -> int:
    repo_root = resolve_repo_root(args.repo_root)
    if is_repo_locked(repo_root):
        print(
            f"[ERROR] {repo_root} is currently locked. Run `restore` first if staging new models.",
            file=sys.stderr,
        )
        return 1

    state = load_state()
    state["repo_root"] = str(repo_root)
    models_map: dict[str, str] = state.setdefault("models", {})

    staged_guides: list[tuple[str, Path, Path]] = []
    prompt_hashes: dict[str, dict[str, str]] = state.setdefault("prompt_hashes", {})

    for model in args.models:
        hashes = verify_canonical_prompts(repo_root, model)
        prompt_hashes[model] = hashes

        staging_dir = (
            args.staging_dir.expanduser().resolve()
            if args.staging_dir and len(args.models) == 1
            else STAGING_ROOT / f"bench-{model}"
        )

        # Prevent clobbering an existing generated build in /tmp unless --force
        if staging_dir.exists() and not args.force:
            existing_outputs = [
                p
                for p in staging_dir.rglob("*")
                if p.is_file() and p.name not in ("PROMPT.md", ".DS_Store")
            ]
            if existing_outputs:
                print(
                    f"[ERROR] {staging_dir} already contains generated files "
                    f"(e.g. {existing_outputs[0]}). Collect them first or pass --force.",
                    file=sys.stderr,
                )
                return 1

        if staging_dir.exists() and args.force:
            shutil.rmtree(staging_dir)

        for game in GAMES:
            dst_game_dir = staging_dir / game
            dst_game_dir.mkdir(parents=True, exist_ok=True)
            src_prompt = repo_root / "simple-prompt" / model / game / "PROMPT.md"
            shutil.copy2(src_prompt, dst_game_dir / "PROMPT.md")

        models_map[model] = str(staging_dir)
        guide_path = write_run_guide(model, staging_dir)
        staged_guides.append((model, staging_dir, guide_path))
        print(f"[STAGE] Staged 4 canonical prompts for '{model}' -> {staging_dir}")

    install_control_script()
    save_state(state)

    if not args.no_lock:
        lock_repository(repo_root, sudo_lock=args.sudo_lock, state=state)

    try:
        cwd = Path.cwd().resolve()
        if str(cwd).startswith(str(repo_root)) and not args.no_lock:
            print(
                "\n[NOTE] Your current shell working directory was inside the locked repo.\n"
                "       Run `cd /tmp` in your terminal before running further shell commands."
            )
    except OSError:
        pass

    print("\n=== Ready for Air-Gapped Run ===")
    for model, staging_dir, guide_path in staged_guides:
        print(f"  Model '{model}':")
        print(f"    Workspace to open : {staging_dir}")
        print(f"    Run guide         : {guide_path}")
        print(
            f"    Collect when done : python3 {CONTROL_SCRIPT} collect {model}"
        )
    return 0


def cmd_collect(args: argparse.Namespace) -> int:
    repo_root = resolve_repo_root(args.repo_root)
    state = load_state()
    models_map: dict[str, str] = state.get("models", {})
    saved_hashes: dict[str, dict[str, str]] = state.get("prompt_hashes", {})

    # 1. Unlock repo first so we can write into simple-prompt/<model>/
    unlock_repository(repo_root, state)

    overall_ok = True
    for model in args.models:
        staging_dir = (
            args.staging_dir.expanduser().resolve()
            if args.staging_dir and len(args.models) == 1
            else Path(models_map.get(model, str(STAGING_ROOT / f"bench-{model}")))
        )
        if not staging_dir.is_dir():
            print(f"[ERROR] Staging directory not found: {staging_dir}", file=sys.stderr)
            overall_ok = False
            continue

        dest_model_dir = repo_root / "simple-prompt" / model
        if not dest_model_dir.is_dir():
            print(
                f"[ERROR] Destination directory not found: {dest_model_dir}",
                file=sys.stderr,
            )
            overall_ok = False
            continue

        copied_games = 0
        for game in GAMES:
            src_game = staging_dir / game
            dst_game = dest_model_dir / game
            if not src_game.is_dir():
                continue

            # Warn if staged PROMPT.md was altered during the run
            staged_prompt = src_game / "PROMPT.md"
            expected_hash = saved_hashes.get(model, {}).get(game)
            if staged_prompt.is_file() and expected_hash:
                if sha256_file(staged_prompt) != expected_hash:
                    print(
                        f"[WARN] Staged {staged_prompt} was modified during the run; "
                        f"preserving canonical repo PROMPT.md."
                    )

            files_to_copy = [
                p
                for p in src_game.rglob("*")
                if p.is_file() and p.name not in ("PROMPT.md", ".DS_Store")
            ]
            if not files_to_copy:
                print(f"[SKIP] {model}/{game}: no generated files in {src_game} yet.")
                continue

            for src_file in files_to_copy:
                rel = src_file.relative_to(src_game)
                dst_file = dst_game / rel
                dst_file.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(src_file, dst_file)
            copied_games += 1
            print(
                f"[COLLECT] {model}/{game}: copied {len(files_to_copy)} file(s) -> {dst_game}"
            )

        passed = validate_target_dir(dest_model_dir, repo_root=repo_root, model_name=model)
        if not passed:
            overall_ok = False

        if args.clean_staging and passed and copied_games == len(GAMES):
            shutil.rmtree(staging_dir)
            print(f"[CLEAN] Removed staging directory {staging_dir}")

        if args.convs and len(args.models) == 1:
            usage_script = repo_root / "simple-prompt" / "metrics" / "usage_report.py"
            metrics_out = repo_root / "simple-prompt" / "metrics" / f"{model}.json"
            print(f"\n[METRICS] Extracting conversation usage -> {metrics_out}")
            subprocess.run(
                [sys.executable, str(usage_script), *args.convs], check=False
            )
            env = {**os.environ, "JSON": "1"}
            res = subprocess.run(
                [sys.executable, str(usage_script), *args.convs],
                env=env,
                capture_output=True,
                text=True,
                check=False,
            )
            if res.returncode == 0 and res.stdout.strip():
                metrics_out.write_text(res.stdout, encoding="utf-8")
                print(f"[METRICS] Wrote {metrics_out}")

    return 0 if overall_ok else 1


def cmd_restore(args: argparse.Namespace) -> int:
    repo_root = resolve_repo_root(args.repo_root)
    state = load_state()
    unlock_repository(repo_root, state)
    return 0


def cmd_status(args: argparse.Namespace) -> int:
    repo_root = resolve_repo_root(args.repo_root)
    state = load_state()
    locked = is_repo_locked(repo_root)
    print(f"Repository : {repo_root}")
    print(f"Lock state : {'LOCKED 🔒 (air-gapped)' if locked else 'UNLOCKED 🔓'}")
    if locked and state.get("locked_at"):
        mode_label = "sudo root-lock" if state.get("sudo_lock") else "chmod 000"
        print(f"Locked at  : {state['locked_at']} ({mode_label})")

    staging_dirs = sorted(
        {*STAGING_ROOT.glob("bench-*"), *Path("/tmp").glob("bench-*")}
    )
    for m_dir in state.get("models", {}).values():
        p = Path(m_dir)
        if p.exists() and p not in staging_dirs:
            staging_dirs.append(p)

    if not staging_dirs:
        print("Staging    : (none in /tmp/bench-*)")
        return 0

    for sdir in staging_dirs:
        print(f"\nStaging directory: {sdir}")
        for game in GAMES:
            gdir = sdir / game
            if not gdir.is_dir():
                print(f"  - {game:<18}: missing directory")
                continue
            gen_files = [
                p
                for p in gdir.rglob("*")
                if p.is_file() and p.name not in ("PROMPT.md", ".DS_Store")
            ]
            if not gen_files:
                print(f"  - {game:<18}: awaiting run (PROMPT.md only)")
            else:
                total_kb = sum(p.stat().st_size for p in gen_files) / 1024
                names = ", ".join(
                    str(p.relative_to(gdir)) for p in sorted(gen_files)[:4]
                )
                if len(gen_files) > 4:
                    names += f" (+{len(gen_files) - 4} more)"
                print(f"  - {game:<18}: READY ({total_kb:.1f} KB: {names})")
    return 0


def cmd_validate(args: argparse.Namespace) -> int:
    repo_root = resolve_repo_root(args.repo_root)
    target = Path(args.target)
    model_name: str | None = None

    if target.is_dir():
        target_dir = target.resolve()
    elif not is_repo_locked(repo_root) and (
        repo_root / "simple-prompt" / args.target
    ).is_dir():
        target_dir = (repo_root / "simple-prompt" / args.target).resolve()
        model_name = args.target
    elif (STAGING_ROOT / f"bench-{args.target}").is_dir():
        target_dir = (STAGING_ROOT / f"bench-{args.target}").resolve()
        model_name = args.target
    elif (Path("/tmp") / f"bench-{args.target}").is_dir():
        target_dir = (Path("/tmp") / f"bench-{args.target}").resolve()
        model_name = args.target
    else:
        print(
            f"[ERROR] Could not resolve '{args.target}' as a directory, "
            f"/tmp/bench-{args.target}, or simple-prompt/{args.target}.",
            file=sys.stderr,
        )
        return 1

    passed = validate_target_dir(target_dir, repo_root=repo_root, model_name=model_name)
    return 0 if passed else 1


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Slopanoid Air-Gapped Clean-Room Benchmark Harness",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=f"""
Examples:
  # 1. Stage /tmp/bench-fable-5.2 (and/or gemini-next) and lock slopanoid repo + .git:
  ./scripts/cleanroom_harness.py prepare fable-5.2
  ./scripts/cleanroom_harness.py prepare fable-5.2 gemini-next --sudo-lock

  # 2. Check progress while repo is locked:
  python3 {CONTROL_SCRIPT} status
  python3 {CONTROL_SCRIPT} validate fable-5.2

  # 3. Unlock repo, copy builds into simple-prompt/<model>/, validate & pull metrics:
  python3 {CONTROL_SCRIPT} collect fable-5.2 --convs <c1> <c2> <c3> <c4>

  # Emergency unlock without collecting:
  python3 {CONTROL_SCRIPT} restore
""",
    )
    parser.add_argument(
        "--repo-root", type=Path, default=None, help="Override slopanoid repo path"
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p_prep = sub.add_parser(
        "prepare",
        help="Stage canonical PROMPT.md files into /tmp/bench-<model> and lock repo",
    )
    p_prep.add_argument(
        "models", nargs="+", help="Model directory name(s), e.g. fable-5.2 gemini-next"
    )
    p_prep.add_argument(
        "--staging-dir",
        type=Path,
        default=None,
        help="Custom staging path (default: /tmp/bench-<model>)",
    )
    p_prep.add_argument(
        "--sudo-lock",
        action="store_true",
        help="Use sudo chown root:wheel + chmod 700 so user processes cannot chmod unlock",
    )
    p_prep.add_argument(
        "--no-lock",
        action="store_true",
        help="Stage /tmp directories without locking the slopanoid repository",
    )
    p_prep.add_argument(
        "--force",
        action="store_true",
        help="Overwrite existing staging directory even if generated files are present",
    )
    p_prep.set_defaults(func=cmd_prepare)

    p_col = sub.add_parser(
        "collect",
        help="Unlock repo, copy generated builds from /tmp into simple-prompt/<model>/, and validate",
    )
    p_col.add_argument("models", nargs="+", help="Model name(s) to collect")
    p_col.add_argument(
        "--staging-dir", type=Path, default=None, help="Custom staging path"
    )
    p_col.add_argument(
        "--convs",
        nargs="+",
        default=None,
        help="Conversation IDs to pass to simple-prompt/metrics/usage_report.py",
    )
    p_col.add_argument(
        "--clean-staging",
        action="store_true",
        help="Delete /tmp/bench-<model> if all 4 games pass validation",
    )
    p_col.set_defaults(func=cmd_collect)

    p_res = sub.add_parser(
        "restore", aliases=["unlock"], help="Unlock slopanoid repository permissions"
    )
    p_res.set_defaults(func=cmd_restore)

    p_stat = sub.add_parser(
        "status", help="Show repo lock status and /tmp/bench-* game progress"
    )
    p_stat.set_defaults(func=cmd_status)

    p_val = sub.add_parser(
        "validate",
        help="Validate a model name or directory (JS syntax, 0 external assets, Canvas, WebAudio, clean-room overlap)",
    )
    p_val.add_argument(
        "target", help="Model name (e.g. fable-5.2) or path to 4-game directory"
    )
    p_val.set_defaults(func=cmd_validate)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
