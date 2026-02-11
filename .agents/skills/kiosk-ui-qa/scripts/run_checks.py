#!/usr/bin/env python3
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[4]
FRONTEND = ROOT / "apps" / "kiosk-frontend"
INDEX_CSS = FRONTEND / "src" / "index.css"
KIOSK_FLOW = FRONTEND / "src" / "components" / "KioskFlow.tsx"


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return ""


def check_global_css(css: str):
    issues = []
    if "html, body, #root" not in css:
        issues.append(("ERROR", "Missing 'html, body, #root' full-height block in index.css"))
    if "body" in css and "overflow: hidden" not in css:
        issues.append(("ERROR", "Body overflow hidden is missing in index.css"))
    if "video, canvas, svg" not in css and ".tayyib*" not in css:
        issues.append(("WARN", "Decorative pointer-events guard not clearly present"))
    return issues


def check_touch_targets(tsx: str):
    issues = []
    for m in re.finditer(r"min-h-\[(\d+)px\]", tsx):
        size = int(m.group(1))
        if size < 44:
            issues.append(("WARN", f"Potential small touch target min-h-[{size}px] at offset {m.start()}"))
    return issues


def check_overlay_risks(tsx: str):
    issues = []
    # Heuristic: find potential full-screen overlays without obvious pointer-events handling.
    lines = tsx.splitlines()
    for idx, line in enumerate(lines, 1):
        if ("fixed inset-0" in line or "absolute inset-0" in line) and "pointer-events-none" not in line:
            if "bg-black/50" in line or "sourcesDrawerOpen" in line:
                continue
            issues.append(("WARN", f"Potential overlay risk at KioskFlow.tsx:{idx}"))
    return issues


def check_scroll_policy(tsx: str):
    issues = []
    # This flags main surface scroll usage for manual review.
    for idx, line in enumerate(tsx.splitlines(), 1):
        if "overflow-y-auto" in line and "sources" not in line.lower():
            issues.append(("WARN", f"Review internal scroll usage at KioskFlow.tsx:{idx}"))
    return issues


def main() -> int:
    css = read_text(INDEX_CSS)
    flow = read_text(KIOSK_FLOW)
    if not css:
        print("ERROR: Cannot read apps/kiosk-frontend/src/index.css")
        return 2
    if not flow:
        print("ERROR: Cannot read apps/kiosk-frontend/src/components/KioskFlow.tsx")
        return 2

    checks = []
    checks.extend(check_global_css(css))
    checks.extend(check_touch_targets(flow))
    checks.extend(check_overlay_risks(flow))
    checks.extend(check_scroll_policy(flow))

    errors = [c for c in checks if c[0] == "ERROR"]
    warns = [c for c in checks if c[0] == "WARN"]

    print("Kiosk UI QA report")
    print("=================")
    if not checks:
        print("PASS: No issues found")
        return 0

    for level, msg in checks:
        print(f"{level}: {msg}")

    print("")
    print(f"Summary: {len(errors)} error(s), {len(warns)} warning(s)")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())

