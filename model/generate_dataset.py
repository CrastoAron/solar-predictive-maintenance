import csv
import math
import os
import random
from datetime import datetime, timedelta


def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def _daylight_factor(ts: datetime) -> float:
    """
    Returns a smooth 0..1 factor: 0 at night, 1 near solar noon.
    Uses a simple fixed sunrise/sunset window with a sine curve.
    """
    minutes = ts.hour * 60 + ts.minute
    sunrise = 6 * 60   # 06:00
    sunset = 18 * 60   # 18:00
    if minutes < sunrise or minutes > sunset:
        return 0.0
    phase = (minutes - sunrise) / (sunset - sunrise)  # 0..1
    return math.sin(math.pi * phase)  # 0 at edges, 1 at midpoint


def main() -> None:
    random.seed(42)

    start = datetime(2022, 1, 1, 0, 0, 0)
    rows = 5000
    step = timedelta(minutes=15)

    out_dir = os.path.join(os.path.dirname(__file__), "data")
    os.makedirs(out_dir, exist_ok=True)

    gen_path = os.path.join(out_dir, "Plant_1_Generation_Data.csv")
    weather_path = os.path.join(out_dir, "Plant_1_Weather_Sensor_Data.csv")

    with open(gen_path, "w", newline="", encoding="utf-8") as f_gen, open(
        weather_path, "w", newline="", encoding="utf-8"
    ) as f_weather:
        gen_writer = csv.writer(f_gen)
        weather_writer = csv.writer(f_weather)

        gen_writer.writerow(["DATE_TIME", "DC_POWER", "AC_POWER"])
        weather_writer.writerow(
            ["DATE_TIME", "IRRADIATION", "AMBIENT_TEMPERATURE", "MODULE_TEMPERATURE"]
        )

        ts = start
        for _ in range(rows):
            day = _daylight_factor(ts)

            # Irradiation (0..1), strictly 0 at night.
            irradiation = 0.0 if day == 0.0 else _clamp(day + random.gauss(0, 0.05), 0.0, 1.0)

            # DC power (0..100 W), strictly 0 at night; proportional to irradiation.
            dc_power = 0.0 if irradiation == 0.0 else _clamp(100.0 * irradiation + random.gauss(0, 5.0), 0.0, 100.0)

            # AC power derived from DC with inverter efficiency + small noise.
            eff = _clamp(random.uniform(0.82, 0.95), 0.0, 1.0)
            ac_power = 0.0 if dc_power == 0.0 else _clamp(dc_power * eff + random.gauss(0, 1.0), 0.0, 100.0)

            # Temperatures correlate with irradiation (warmer during day).
            ambient = _clamp(22.0 + 18.0 * irradiation + random.gauss(0, 1.2), 20.0, 45.0)
            module = _clamp(ambient + 6.0 + 18.0 * irradiation + random.gauss(0, 1.5), 20.0, 70.0)

            dt_str = ts.strftime("%Y-%m-%d %H:%M:%S")

            gen_writer.writerow([dt_str, f"{dc_power:.2f}", f"{ac_power:.2f}"])
            weather_writer.writerow(
                [dt_str, f"{irradiation:.4f}", f"{ambient:.2f}", f"{module:.2f}"]
            )

            ts += step

    print(f"Wrote: {gen_path}")
    print(f"Wrote: {weather_path}")


if __name__ == "__main__":
    main()
