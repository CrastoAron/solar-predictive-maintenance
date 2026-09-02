#!/usr/bin/env python3
"""Send simulated ESP32 telemetry to the FastAPI HTTP endpoint through ngrok."""

from __future__ import annotations

import argparse
import json
import random
import sys
import time
from datetime import datetime, timezone
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit, urlunsplit
from urllib.request import Request, urlopen


TELEMETRY_PATH = "/api/telemetry"


def endpoint_url(value: str) -> str:
    """Accept an ngrok base URL or the complete telemetry endpoint URL."""
    parsed = urlsplit(value.strip().rstrip("/"))
    if parsed.scheme != "https" or not parsed.netloc:
        raise argparse.ArgumentTypeError("--url must be a public HTTPS ngrok URL")
    if parsed.path not in ("", TELEMETRY_PATH):
        raise argparse.ArgumentTypeError(f"--url must end with {TELEMETRY_PATH} or contain no path")
    return urlunsplit((parsed.scheme, parsed.netloc, TELEMETRY_PATH, "", ""))


def make_payload(device_id: str, hardware_status: list[int] | None = None) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "device_id": device_id,
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "voltage": round(random.uniform(17.5, 20.5), 3),
        "current": round(random.uniform(0.8, 2.2), 3),
        "lux": round(random.uniform(20_000, 85_000), 1),
        "temperature": round(random.uniform(22.0, 42.0), 2),
        "humidity": round(random.uniform(35.0, 75.0), 2),
    }
    if hardware_status is not None:
        payload["hardware_status"] = dict(
            zip(("bme280", "ina219", "bh1750", "ds3231"), hardware_status)
        )
    return payload


def post_telemetry(url: str, payload: dict[str, Any], timeout: float) -> int:
    request = Request(
        url,
        data=json.dumps(payload, separators=(",", ":")).encode("utf-8"),
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )
    with urlopen(request, timeout=timeout) as response:
        return response.status


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Post simulated ESP32 telemetry to FastAPI through an ngrok HTTPS tunnel."
    )
    parser.add_argument(
        "--url",
        required=True,
        type=endpoint_url,
        help="ngrok base URL or full /api/telemetry URL",
    )
    parser.add_argument("--device-id", default="esp32-01")
    parser.add_argument("--interval", type=float, default=2.0, help="Seconds between requests (default: 2)")
    parser.add_argument("--count", type=int, default=0, help="Requests to send (0 runs forever)")
    parser.add_argument("--timeout", type=float, default=10.0, help="HTTP timeout in seconds (default: 10)")
    parser.add_argument(
        "--hardware-status",
        nargs=4,
        metavar=("BME280", "INA219", "BH1750", "DS3231"),
        type=int,
        default=None,
        help="Optional diagnostic status values, each in the range 0..5",
    )
    args = parser.parse_args()
    if args.interval < 0 or args.count < 0 or args.timeout <= 0:
        parser.error("--interval and --count must be non-negative; --timeout must be positive")
    if args.hardware_status and any(value < 0 or value > 5 for value in args.hardware_status):
        parser.error("--hardware-status values must be in the range 0..5")
    return args


def main() -> None:
    args = parse_args()
    sent = 0
    try:
        while not args.count or sent < args.count:
            payload = make_payload(args.device_id, args.hardware_status)
            sent += 1
            try:
                status = post_telemetry(args.url, payload, args.timeout)
                print(f"[{sent:05d}] HTTP {status} {json.dumps(payload, separators=(',', ':'))}")
            except HTTPError as exc:
                print(f"[{sent:05d}] HTTP {exc.code}: {exc.read().decode('utf-8', 'replace')}", file=sys.stderr)
            except URLError as exc:
                print(f"[{sent:05d}] request failed: {exc.reason}", file=sys.stderr)
            if not args.count or sent < args.count:
                time.sleep(args.interval)
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
