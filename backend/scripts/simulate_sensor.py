from __future__ import annotations

import argparse
import json
import math
import random
import time
from dataclasses import dataclass
from datetime import datetime, timezone

import paho.mqtt.client as mqtt


@dataclass
class Scenario:
    name: str
    lux_range: tuple[float, float]
    voltage_range: tuple[float, float]
    current_range: tuple[float, float]
    temperature_range: tuple[float, float]
    humidity_range: tuple[float, float]


SCENARIOS: dict[str, Scenario] = {
    "normal": Scenario(
        name="normal",
        lux_range=(45_000, 95_000),
        voltage_range=(17.0, 21.5),
        current_range=(1.6, 3.2),
        temperature_range=(25.0, 40.0),
        humidity_range=(35.0, 75.0),
    ),
    # Degraded output: low lux or partially shaded; slightly higher temps.
    "degraded": Scenario(
        name="degraded",
        lux_range=(12_000, 40_000),
        voltage_range=(14.0, 18.5),
        current_range=(0.8, 2.0),
        temperature_range=(30.0, 55.0),
        humidity_range=(35.0, 85.0),
    ),
    # Fault: very low current / abnormal readings; very hot module.
    "fault": Scenario(
        name="fault",
        lux_range=(5_000, 30_000),
        voltage_range=(10.0, 16.0),
        current_range=(0.05, 0.8),
        temperature_range=(45.0, 75.0),
        humidity_range=(20.0, 90.0),
    ),
}


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def _rand_range(rng: tuple[float, float]) -> float:
    return random.uniform(rng[0], rng[1])


def _daylight_factor(t: float) -> float:
    """
    Smooth 0..1 factor to emulate a daylight curve.
    `t` is a monotonically increasing time (seconds).
    """
    # ~2 minute cycle for quick visual changes in UI while testing.
    phase = (t % 120.0) / 120.0
    # cosine bell: 0 at night edges, 1 mid-day
    return 0.5 - 0.5 * math.cos(2 * math.pi * phase)


def _make_payload(*, device_id: str, scenario: Scenario, t0: float) -> dict:
    now = datetime.now(timezone.utc)
    daylight = _daylight_factor(time.time() - t0)

    # Base values from scenario ranges.
    lux_base = _rand_range(scenario.lux_range)
    # Scale lux by daylight curve (keeps values moving, even in "normal").
    lux = lux_base * (0.2 + 0.8 * daylight)

    voltage = _rand_range(scenario.voltage_range)
    current = _rand_range(scenario.current_range)
    temperature = _rand_range(scenario.temperature_range)
    humidity = _rand_range(scenario.humidity_range)

    # Add a tiny bit of sensor noise.
    voltage += random.uniform(-0.15, 0.15)
    current += random.uniform(-0.05, 0.05)
    temperature += random.uniform(-0.4, 0.4)
    humidity += random.uniform(-1.0, 1.0)

    # Ensure plausible bounds.
    lux = _clamp(lux, 0.0, 120_000.0)
    voltage = _clamp(voltage, 0.0, 30.0)
    current = _clamp(current, 0.0, 10.0)
    temperature = _clamp(temperature, -10.0, 100.0)
    humidity = _clamp(humidity, 0.0, 100.0)

    return {
        "device_id": device_id,
        # Backend accepts ISO-8601; MQTT subscriber normalizes it to "...Z".
        "timestamp": now.isoformat().replace("+00:00", "Z"),
        "voltage": round(voltage, 3),
        "current": round(current, 3),
        "lux": round(lux, 1),
        "temperature": round(temperature, 2),
        "humidity": round(humidity, 2),
    }


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
        choices=["normal", "degraded", "fault", "mixed"],
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
    random.seed()  # use system entropy

    client = mqtt.Client()
    client.connect(args.host, args.port, keepalive=60)

    t0 = time.time()
    sent = 0
    try:
        while True:
            scenario = choose_scenario(
                args.mode,
                degraded_prob=float(args.degraded_prob),
                fault_prob=float(args.fault_prob),
            )
            payload = _make_payload(device_id=args.device_id, scenario=scenario, t0=t0)
            payload_str = json.dumps(payload, separators=(",", ":"))

            client.publish(args.topic, payload_str, qos=int(args.qos))
            sent += 1

            print(
                f"[{sent:05d}] mode={scenario.name:<8} "
                f"V={payload['voltage']:>6} I={payload['current']:>6} "
                f"lux={payload['lux']:>8} T={payload['temperature']:>6} "
                f"H={payload['humidity']:>6} ts={payload['timestamp']}"
            )

            if args.count and sent >= int(args.count):
                break
            time.sleep(float(args.interval))
    except KeyboardInterrupt:
        pass
    finally:
        client.disconnect()


if __name__ == "__main__":
    main()

