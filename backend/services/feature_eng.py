from __future__ import annotations

import pandas as pd


def _rate_of_change(series: pd.Series) -> float:
    clean = pd.to_numeric(series, errors="coerce").dropna()
    if len(clean) < 2:
        return 0.0
    return float(clean.iloc[-1] - clean.iloc[0])


def compute_features(df: pd.DataFrame) -> dict[str, float]:
    """
    Input DataFrame columns:
    [timestamp, voltage, current, power, lux, temperature, humidity]
    """
    if df.empty:
        raise ValueError("Cannot compute features from empty dataframe")

    working = df.copy()
    numeric_cols = ["voltage", "current", "power", "lux", "temperature", "humidity"]
    for col in numeric_cols:
        working[col] = pd.to_numeric(working[col], errors="coerce")

    working = working.dropna(subset=numeric_cols)
    if working.empty:
        raise ValueError("No valid rows available for feature engineering")

    voltage_mean = float(working["voltage"].mean())
    voltage_std = float(working["voltage"].std(ddof=0))
    current_mean = float(working["current"].mean())
    current_std = float(working["current"].std(ddof=0))
    power_mean = float(working["power"].mean())
    power_std = float(working["power"].std(ddof=0))
    lux_mean = float(working["lux"].mean())
    temperature_mean = float(working["temperature"].mean())
    humidity_mean = float(working["humidity"].mean())

    power_rate_of_change = _rate_of_change(working["power"])
    voltage_rate_of_change = _rate_of_change(working["voltage"])
    efficiency_ratio = float(power_mean / (lux_mean / 1000.0 + 0.001))

    return {
        "voltage_mean": voltage_mean,
        "voltage_std": voltage_std,
        "current_mean": current_mean,
        "current_std": current_std,
        "power_mean": power_mean,
        "power_std": power_std,
        "lux_mean": lux_mean,
        "temperature_mean": temperature_mean,
        "humidity_mean": humidity_mean,
        "power_rate_of_change": power_rate_of_change,
        "voltage_rate_of_change": voltage_rate_of_change,
        "efficiency_ratio": efficiency_ratio,
    }

