from __future__ import annotations

import argparse
import html
import json
import math
import random
import sys
import threading
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

import paho.mqtt.client as mqtt

# This script is normally run as `python scripts/simulate_sensor.py` from the
# backend directory. Ensure local service imports also work from other CWDs.
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from services.expected_power_runner import ExpectedPowerRunner, get_expected_power_runner


@dataclass
class Scenario:
    name: str
    lux_range: tuple[float, float]
    voltage_range: tuple[float, float]
    temperature_range: tuple[float, float]
    humidity_range: tuple[float, float]
    performance_ratio_range: tuple[float, float] | None = None
    is_low_light: bool = False


SCENARIOS: dict[str, Scenario] = {
    "normal": Scenario(
        name="normal",
        lux_range=(20_000, 54_000),
        voltage_range=(7.0, 11.0),
        temperature_range=(25.0, 45.0),
        humidity_range=(40.0, 80.0),
        performance_ratio_range=(0.90, 1.05),
    ),
    # Daylight output is 55--75% of the same baseline used by the dashboard.
    "degraded": Scenario(
        name="degraded",
        lux_range=(20_000, 50_000),
        voltage_range=(7.0, 11.0),
        temperature_range=(25.0, 50.0),
        humidity_range=(40.0, 85.0),
        performance_ratio_range=(0.55, 0.75),
    ),
    # Daylight output is 10--45% of expected output, a strong anomaly.
    "fault": Scenario(
        name="fault",
        lux_range=(15_000, 45_000),
        voltage_range=(7.0, 11.0),
        temperature_range=(25.0, 50.0),
        humidity_range=(40.0, 85.0),
        performance_ratio_range=(0.10, 0.45),
    ),
    # Low light is normal nighttime behaviour, not a fault condition.
    "night": Scenario(
        name="night",
        lux_range=(0.0, 4_999.0),
        voltage_range=(0.0, 1.0),
        temperature_range=(20.0, 35.0),
        humidity_range=(45.0, 90.0),
        is_low_light=True,
    ),
}

SENSOR_NAMES = ("voltage", "current", "lux", "temperature", "humidity")
HARDWARE_NAMES = ("bme280", "ina219", "bh1750", "ds3231")


class LiveSimulationConfig:
    """Thread-safe settings shared by the publisher and local control page."""

    def __init__(self, args: argparse.Namespace) -> None:
        self._lock = threading.Lock()
        self.mode = args.mode
        self.interval = float(args.interval)
        self.device_id = args.device_id
        self.sensor_overrides: dict[str, float] = {}
        if args.override_sensor and args.override_value is not None:
            self.sensor_overrides[args.override_sensor] = float(args.override_value)
        self.hardware_status: dict[str, int] | None = None
        if args.hardware_status is not None:
            self.hardware_status = dict(zip(HARDWARE_NAMES, map(int, args.hardware_status)))

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            return {
                "mode": self.mode,
                "interval": self.interval,
                "device_id": self.device_id,
                "sensor_overrides": dict(self.sensor_overrides),
                "hardware_status": dict(self.hardware_status) if self.hardware_status else None,
            }

    def update(self, form: dict[str, list[str]]) -> None:
        mode = form.get("mode", [self.mode])[0]
        if mode not in (*SCENARIOS, "mixed"):
            raise ValueError("Unknown scenario mode.")
        try:
            interval = float(form.get("interval", [str(self.interval)])[0])
        except ValueError as exc:
            raise ValueError("Interval must be a number.") from exc
        if not math.isfinite(interval) or interval <= 0:
            raise ValueError("Interval must be a finite number greater than zero.")

        overrides: dict[str, float] = {}
        for name in SENSOR_NAMES:
            raw_value = form.get(f"override_{name}", [""])[0].strip()
            if raw_value:
                try:
                    override_value = float(raw_value)
                except ValueError as exc:
                    raise ValueError(f"{name.title()} override must be a number.") from exc
                if not math.isfinite(override_value):
                    raise ValueError(f"{name.title()} override must be finite.")
                overrides[name] = override_value

        enabled = form.get("hardware_enabled", [""])[0] == "on"
        hardware_status: dict[str, int] | None = None
        if enabled:
            hardware_status = {}
            for name in HARDWARE_NAMES:
                try:
                    value = int(form.get(f"hardware_{name}", ["0"])[0])
                except ValueError as exc:
                    raise ValueError(f"{name.upper()} status must be an integer from 0 to 5.") from exc
                if not 0 <= value <= 5:
                    raise ValueError(f"{name.upper()} status must be between 0 and 5.")
                hardware_status[name] = value

        with self._lock:
            self.mode = mode
            self.interval = interval
            self.device_id = form.get("device_id", [self.device_id])[0].strip() or self.device_id
            self.sensor_overrides = overrides
            self.hardware_status = hardware_status


def _control_page(config: dict[str, Any], message: str = "") -> str:
    overrides = config["sensor_overrides"]
    hardware = config["hardware_status"] or dict.fromkeys(HARDWARE_NAMES, 0)
    options = "".join(
        f'<option value="{mode}" {"selected" if config["mode"] == mode else ""}>{mode.title()}</option>'
        for mode in ("normal", "degraded", "fault", "night", "mixed")
    )
    sensor_inputs = "".join(
        f'<label>{name.title()} <input type="number" step="any" name="override_{name}" '
        f'value="{html.escape(str(overrides.get(name, "")))}" placeholder="Automatic"></label>'
        for name in SENSOR_NAMES
    )
    hardware_inputs = "".join(
        f'<label>{name.upper()} <input type="number" min="0" max="5" name="hardware_{name}" '
        f'value="{hardware[name]}"></label>'
        for name in HARDWARE_NAMES
    )
    notice = f'<p class="notice">{html.escape(message)}</p>' if message else ""
    checked = "checked" if config["hardware_status"] else ""
    return f"""<!doctype html>
<html><head><meta charset="utf-8"><title>SolarShield Simulator</title><style>
body{{font-family:system-ui,sans-serif;background:#f1f5f9;color:#172033;margin:0;padding:32px}}main{{max-width:760px;margin:auto;background:white;border-radius:16px;padding:28px;box-shadow:0 8px 30px #0f172a18}}h1{{margin-top:0;color:#0f766e}}fieldset{{border:1px solid #cbd5e1;border-radius:10px;margin:18px 0;padding:16px}}legend{{font-weight:700}}label{{display:inline-flex;flex-direction:column;gap:5px;margin:8px;min-width:130px}}input,select{{padding:8px;border:1px solid #94a3b8;border-radius:6px;font:inherit}}button{{background:#0f766e;color:white;border:0;border-radius:7px;padding:11px 18px;font-weight:700;cursor:pointer}}.notice{{background:#dcfce7;color:#166534;padding:10px;border-radius:7px}}small{{color:#475569}}</style></head>
<body><main><h1>SolarShield Sensor Simulator</h1><p>Changes are used by the next published reading—no simulator restart needed.</p>{notice}
<form method="post" action="/settings"><fieldset><legend>Scenario</legend><label>Mode <select name="mode">{options}</select></label><label>Publish interval (seconds)<input type="number" min="0.1" step="0.1" name="interval" value="{config["interval"]}"></label><label>Device ID<input name="device_id" value="{html.escape(str(config["device_id"]))}"></label></fieldset>
<fieldset><legend>Fixed sensor values <small>Leave blank to use scenario-generated data.</small></legend>{sensor_inputs}</fieldset>
<fieldset><legend><label style="display:inline-flex;flex-direction:row;align-items:center;min-width:0"><input type="checkbox" name="hardware_enabled" {checked}> Include hardware diagnostics</label></legend>{hardware_inputs}</fieldset>
<button type="submit">Apply settings</button></form></main></body></html>"""


def start_control_server(config: LiveSimulationConfig, host: str, port: int) -> ThreadingHTTPServer:
    class ControlHandler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:  # noqa: N802
            if urlparse(self.path).path != "/":
                self.send_error(404)
                return
            body = _control_page(config.snapshot()).encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_POST(self) -> None:  # noqa: N802
            if urlparse(self.path).path != "/settings":
                self.send_error(404)
                return
            length = int(self.headers.get("Content-Length", "0"))
            form = parse_qs(self.rfile.read(length).decode(), keep_blank_values=True)
            try:
                config.update(form)
                message = "Settings applied."
            except ValueError as exc:
                message = f"Could not apply settings: {exc}"
            body = _control_page(config.snapshot(), message).encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, format: str, *args: Any) -> None:
            return

    server = ThreadingHTTPServer((host, port), ControlHandler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def _rand_range(rng: tuple[float, float]) -> float:
    return random.uniform(rng[0], rng[1])


def _make_payload(
    *,
    device_id: str,
    scenario: Scenario,
    expected_power_runner: ExpectedPowerRunner,
    sensor_overrides: dict[str, float] | None = None,
    hardware_status: dict[str, int] | None = None,
) -> tuple[dict[str, Any], float | None]:
    """Create telemetry that deterministically exercises the expected-power statuses.

    Daylight scenarios first obtain the baseline's expected output, then set
    current so `voltage * current` lands in that scenario's ratio band. The
    expected-power model therefore sees the same scale at simulation and
    dashboard time. No internal testing fields are added to the MQTT payload.
    """
    now = datetime.now(timezone.utc)
    lux = _rand_range(scenario.lux_range)
    voltage = _rand_range(scenario.voltage_range)
    temperature = _rand_range(scenario.temperature_range)
    humidity = _rand_range(scenario.humidity_range)

    # Add a tiny bit of sensor noise before calculating controlled output.
    voltage += random.uniform(-0.15, 0.15)
    temperature += random.uniform(-0.4, 0.4)
    humidity += random.uniform(-1.0, 1.0)

    # Ensure plausible bounds.
    lux = _clamp(lux, 0.0, 120_000.0)
    voltage = _clamp(voltage, 0.0, 30.0)
    temperature = _clamp(temperature, -10.0, 100.0)
    humidity = _clamp(humidity, 0.0, 100.0)

    timestamp = now.isoformat().replace("+00:00", "Z")
    if scenario.is_low_light:
        current = 0.0
        target_ratio = None
    else:
        # Expected power is independent of the temporary voltage/current values.
        baseline = expected_power_runner.predict(
            {
                "device_id": device_id,
                "timestamp": timestamp,
                "voltage": voltage,
                "current": 0.0,
                "power": 0.0,
                "lux": lux,
                "temperature": temperature,
                "humidity": humidity,
            }
        )
        expected_power = baseline["expected_power"]
        if expected_power is None:
            raise RuntimeError("Daylight simulator scenario received a low-light baseline result.")
        target_ratio = _rand_range(scenario.performance_ratio_range or (1.0, 1.0))
        target_power = float(expected_power) * target_ratio
        current = target_power / max(voltage, 0.1)

    current = _clamp(current, 0.0, 10.0)

    payload = {
        "device_id": device_id,
        # Backend accepts ISO-8601; MQTT subscriber normalizes it to "...Z".
        "timestamp": timestamp,
        "voltage": round(voltage, 3),
        "current": round(current, 3),
        "lux": round(lux, 1),
        "temperature": round(temperature, 2),
        "humidity": round(humidity, 2),
    }

    if sensor_overrides:
        for sensor_name, override_value in sensor_overrides.items():
            if sensor_name in payload and override_value is not None:
                limit = 120_000.0 if sensor_name == "lux" else 100.0 if sensor_name == "temperature" else 10.0 if sensor_name == "current" else 30.0 if sensor_name == "voltage" else 100.0
                payload[sensor_name] = round(_clamp(float(override_value), 0.0, limit), 3)

    if hardware_status is not None:
        payload["hardware_status"] = {
            "bme280": int(hardware_status["bme280"]),
            "ina219": int(hardware_status["ina219"]),
            "bh1750": int(hardware_status["bh1750"]),
            "ds3231": int(hardware_status["ds3231"]),
        }

    return payload, target_ratio


def _prompt(text: str, default: str) -> str:
    answer = input(f"{text} [{default}]: ").strip()
    return answer or default


def _prompt_choice(text: str, choices: list[str], default: str) -> str:
    choices_str = "/".join(choices)
    while True:
        answer = input(f"{text} ({choices_str}) [{default}]: ").strip().lower()
        if answer == "":
            return default
        if answer in choices:
            return answer
        print(f"Please choose one of: {choices_str}")


def _prompt_float(text: str, default: float) -> float:
    while True:
        answer = input(f"{text} [{default}]: ").strip()
        if answer == "":
            return default
        try:
            return float(answer)
        except ValueError:
            print("Enter a numeric value.")


def _prompt_int(text: str, default: int, min_value: int | None = None, max_value: int | None = None) -> int:
    while True:
        answer = input(f"{text} [{default}]: ").strip()
        if answer == "":
            value = default
        else:
            try:
                value = int(answer)
            except ValueError:
                print("Enter an integer value.")
                continue
        if min_value is not None and value < min_value:
            print(f"Value must be >= {min_value}.")
            continue
        if max_value is not None and value > max_value:
            print(f"Value must be <= {max_value}.")
            continue
        return value


def _prompt_yes_no(text: str, default: bool) -> bool:
    default_str = "Y/n" if default else "y/N"
    while True:
        answer = input(f"{text} ({default_str}): ").strip().lower()
        if answer == "":
            return default
        if answer in ("y", "yes"):
            return True
        if answer in ("n", "no"):
            return False
        print("Enter y or n.")


def interactive_config(args: argparse.Namespace) -> None:
    print("Interactive sensor simulator setup")
    args.host = _prompt("MQTT host", args.host)
    args.port = _prompt_int("MQTT port", args.port)
    args.topic = _prompt("MQTT topic", args.topic)
    args.qos = _prompt_int("MQTT QoS", args.qos, 0, 2)
    args.device_id = _prompt("Device id", args.device_id)
    args.interval = _prompt_float("Publish interval (seconds)", args.interval)
    args.count = _prompt_int("Number of messages to publish (0 = forever)", args.count, 0)
    args.mode = _prompt_choice("Scenario mode", ["normal", "degraded", "fault", "night", "mixed"], args.mode)

    if _prompt_yes_no("Override a specific sensor value?", False):
        sensor = _prompt_choice(
            "Choose sensor to override",
            ["voltage", "current", "lux", "temperature", "humidity"],
            "voltage",
        )
        value = _prompt_float(f"Override value for {sensor}", 0.0)
        args.override_sensor = sensor
        args.override_value = value

    if _prompt_yes_no("Include hardware_status diagnostics payload?", False):
        args.hardware_status = [
            _prompt_int("BME280 status (0-5)", 0, 0, 5),
            _prompt_int("INA219 status (0-5)", 0, 0, 5),
            _prompt_int("BH1750 status (0-5)", 0, 0, 5),
            _prompt_int("DS3231 status (0-5)", 0, 0, 5),
        ]


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Publish simulated sensor readings to MQTT.")
    p.add_argument("--host", default="localhost", help="MQTT host (default: localhost)")
    p.add_argument("--port", type=int, default=1883, help="MQTT port (default: 1883)")
    p.add_argument("--topic", default="solar/sensors", help="MQTT topic (default: solar/sensors)")
    p.add_argument("--qos", type=int, default=1, help="MQTT QoS (default: 1)")
    p.add_argument("--device-id", default="esp32-01", help="Device id tag (default: esp32-01)")
    p.add_argument("--interval", type=float, default=2.0, help="Seconds between publishes (default: 2.0)")
    p.add_argument(
        "--mode",
        choices=["normal", "degraded", "fault", "night", "mixed"],
        default="mixed",
        help="Scenario mode (default: mixed)",
    )
    p.add_argument(
        "--fault-prob",
        type=float,
        default=0.08,
        help="Probability of a fault sample when mode=mixed (default: 0.08)",
    )
    p.add_argument(
        "--degraded-prob",
        type=float,
        default=0.18,
        help="Probability of a degraded sample when mode=mixed (default: 0.18)",
    )
    p.add_argument(
        "--count",
        type=int,
        default=0,
        help="Publish N messages then exit (0 = run forever).",
    )
    p.add_argument(
        "--override-sensor",
        choices=["voltage", "current", "lux", "temperature", "humidity"],
        default=None,
        help="Optionally override a single sensor value for every published payload.",
    )
    p.add_argument(
        "--override-value",
        type=float,
        default=None,
        help="Override value to use with --override-sensor.",
    )
    p.add_argument(
        "--hardware-status",
        nargs=4,
        metavar=("BME280","INA219","BH1750","DS3231"),
        type=int,
        default=None,
        help="Optional hardware_status values to include in every payload.",
    )
    p.add_argument(
        "--interactive",
        action="store_true",
        help="Run an interactive prompt to configure the simulation.",
    )
    p.add_argument(
        "--web",
        action="store_true",
        help="Start a local control page that can change settings while the simulator runs.",
    )
    p.add_argument("--web-host", default="127.0.0.1", help="Control page host (default: 127.0.0.1)")
    p.add_argument("--web-port", type=int, default=8765, help="Control page port (default: 8765)")
    return p.parse_args()


def choose_scenario(mode: str, *, degraded_prob: float, fault_prob: float) -> Scenario:
    if mode != "mixed":
        return SCENARIOS[mode]

    r = random.random()
    if r < fault_prob:
        return SCENARIOS["fault"]
    if r < fault_prob + degraded_prob:
        return SCENARIOS["degraded"]
    return SCENARIOS["normal"]


def main() -> None:
    args = parse_args()
    if len(sys.argv) == 1 and sys.stdin.isatty():
        args.interactive = True

    if args.interactive:
        interactive_config(args)

    random.seed()  # use system entropy

    live_config = LiveSimulationConfig(args)
    control_server: ThreadingHTTPServer | None = None
    if args.web:
        control_server = start_control_server(live_config, args.web_host, args.web_port)
        print(f"Simulator controls: http://{args.web_host}:{args.web_port}")

    client = mqtt.Client()
    client.connect(args.host, args.port, keepalive=60)

    expected_power_runner = get_expected_power_runner()
    if not expected_power_runner.is_ready():
        raise RuntimeError(
            "Expected-power baseline assets are required for controlled scenarios. "
            "Run model/train_expected_power.py first."
        )

    # QoS 1 publishing requires Paho's network loop to receive PUBACKs and
    # flush queued messages. Without it the terminal keeps printing generated
    # samples while the broker stops receiving them after the in-flight queue
    # fills, which makes the dashboard appear frozen until a restart.
    client.loop_start()

    sent = 0
    try:
        while True:
            settings = live_config.snapshot()
            scenario = choose_scenario(
                str(settings["mode"]),
                degraded_prob=float(args.degraded_prob),
                fault_prob=float(args.fault_prob),
            )
            payload, target_ratio = _make_payload(
                device_id=str(settings["device_id"]),
                scenario=scenario,
                expected_power_runner=expected_power_runner,
                sensor_overrides=settings["sensor_overrides"] or None,
                hardware_status=settings["hardware_status"],
            )
            payload_str = json.dumps(payload, separators=(",", ":"))

            client.publish(args.topic, payload_str, qos=int(args.qos))
            sent += 1

            status_details = ""
            if "hardware_status" in payload:
                hw = payload["hardware_status"]
                status_details = (
                    f" hw=bme280:{hw['bme280']} ina219:{hw['ina219']} "
                    f"bh1750:{hw['bh1750']} ds3231:{hw['ds3231']}"
                )

            print(
                f"[{sent:05d}] mode={scenario.name:<8} "
                f"V={payload['voltage']:>6} I={payload['current']:>6} "
                f"lux={payload['lux']:>8} T={payload['temperature']:>6} "
                f"P={payload['voltage'] * payload['current']:>6.3f} "
                f"ratio={'low-light' if target_ratio is None else f'{target_ratio:.0%}':>9} "
                f"H={payload['humidity']:>6} ts={payload['timestamp']}" + status_details
            )

            if args.count and sent >= int(args.count):
                break
            time.sleep(float(settings["interval"]))
    except KeyboardInterrupt:
        pass
    finally:
        try:
            client.disconnect()
        finally:
            client.loop_stop()
        if control_server is not None:
            control_server.shutdown()
            control_server.server_close()


if __name__ == "__main__":
    main()
