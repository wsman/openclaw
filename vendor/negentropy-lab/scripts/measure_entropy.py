#!/usr/bin/env python3
import argparse
import json
import sys
import urllib.request


def fetch_json(url: str) -> dict:
    with urllib.request.urlopen(url, timeout=10) as response:
        return json.loads(response.read().decode("utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser(description="Measure authority entropy from a live Negentropy-Lab server.")
    parser.add_argument(
        "--url",
        default="http://127.0.0.1:3000/api/authority/state",
        help="Authority snapshot endpoint",
    )
    parser.add_argument(
        "--baseline",
        type=float,
        default=0.3,
        help="Baseline global entropy for delta validation",
    )
    args = parser.parse_args()

    payload = fetch_json(args.url)
    authority = payload.get("authority", payload)
    entropy = authority.get("entropy", {})
    current_global = float(entropy.get("global", 0.0))
    current_system = float(entropy.get("system", 0.0))
    current_financial = float(entropy.get("financial", 0.0))
    breaker_level = int(entropy.get("breakerLevel", authority.get("governance", {}).get("breakerLevel", 0)))
    delta = current_global - args.baseline

    summary = {
        "baseline_global_entropy": args.baseline,
        "current_global_entropy": current_global,
        "delta_h_sys": round(delta, 6),
        "system_entropy": current_system,
        "financial_entropy": current_financial,
        "breaker_level": breaker_level,
        "ok": delta <= 0,
    }

    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0 if summary["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
