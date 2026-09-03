"""Generate reusable engineering plots from a SolarShield-style telemetry folder.

The script discovers tabular datasets rather than relying on a fixed filename or
schema. It selects the most suitable file based on readable tabular content,
row count, and detected solar measurements, then generates only plots whose
required columns are present.

Examples:
    python model/solar_analysis.py
    python model/solar_analysis.py ./new_dataset --output ./graphs
    python model/solar_analysis.py ./new_dataset --model ./model.pkl
"""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys
from dataclasses import dataclass, replace
from pathlib import Path
from typing import Any, Callable

# Some development environments have a read-only home directory. Keep
# Matplotlib's cache outside the repository and avoid failing before analysis.
os.environ.setdefault("MPLCONFIGDIR", "/tmp/solarshield-matplotlib")

import matplotlib.dates as mdates
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns


SUPPORTED_SUFFIXES = {".csv", ".xlsx", ".xls", ".json", ".parquet"}
DEFAULT_DATA_DIR = Path(__file__).resolve().parent / "cleaned_data"

PLOT_STYLE = {
    "figure.dpi": 120,
    "axes.titlesize": 14,
    "axes.labelsize": 11,
    "xtick.labelsize": 9,
    "ytick.labelsize": 9,
}


@dataclass(frozen=True)
class ColumnMapping:
    """Detected data columns. Values are source column names or ``None``."""

    timestamp: str | None = None
    irradiance: str | None = None
    temperature: str | None = None
    voltage: str | None = None
    current: str | None = None
    power: str | None = None
    prediction: str | None = None

    def as_dict(self) -> dict[str, str | None]:
        return {
            "timestamp": self.timestamp,
            "irradiance": self.irradiance,
            "temperature": self.temperature,
            "voltage": self.voltage,
            "current": self.current,
            "power": self.power,
            "prediction": self.prediction,
        }


def normalise_name(value: str) -> str:
    """Lowercase a column name and remove punctuation for matching."""
    return re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")


def read_tabular_file(path: Path) -> pd.DataFrame:
    """Read one supported tabular file, raising a readable error if unsupported."""
    suffix = path.suffix.lower()
    if suffix == ".csv":
        return pd.read_csv(path)
    if suffix in {".xlsx", ".xls"}:
        return pd.read_excel(path)
    if suffix == ".parquet":
        return pd.read_parquet(path)
    if suffix == ".json":
        try:
            return pd.read_json(path)
        except ValueError:
            # A common telemetry format is newline-delimited JSON.
            return pd.read_json(path, lines=True)
    raise ValueError(f"Unsupported file type: {path.suffix}")


def discover_datasets(dataset_path: Path) -> list[Path]:
    """Find likely tabular data files recursively, excluding prior graph output."""
    if dataset_path.is_file():
        if dataset_path.suffix.lower() not in SUPPORTED_SUFFIXES:
            raise ValueError(f"Unsupported input file: {dataset_path}")
        return [dataset_path]
    if not dataset_path.is_dir():
        raise FileNotFoundError(f"Dataset path does not exist: {dataset_path}")

    return sorted(
        path
        for path in dataset_path.rglob("*")
        if path.is_file()
        and path.suffix.lower() in SUPPORTED_SUFFIXES
        and "graphs" not in path.parts
    )


def _best_match(columns: list[str], predicates: list[Callable[[str], bool]]) -> str | None:
    """Return the first source column whose normalised name matches a predicate."""
    for predicate in predicates:
        for column in columns:
            if predicate(normalise_name(column)):
                return column
    return None


def detect_columns(frame: pd.DataFrame) -> ColumnMapping:
    """Map common solar telemetry naming conventions without renaming source data."""
    columns = list(frame.columns)
    contains = lambda *terms: lambda name: all(term in name for term in terms)
    starts = lambda *terms: lambda name: any(name.startswith(term) for term in terms)

    prediction = _best_match(
        columns,
        [
            contains("predicted", "power"),
            contains("forecast", "power"),
            contains("expected", "power"),
            starts("predicted_output", "forecast_output", "expected_output"),
        ],
    )
    power = _best_match(
        columns,
        [
            contains("actual", "power"),
            contains("dc", "power"),
            contains("ac", "power"),
            lambda name: name in {"power", "power_output", "output", "generation"},
            contains("power"),
        ],
    )
    # Do not accidentally select predicted/expected power as measured power.
    if power == prediction:
        power = _best_match(
            [column for column in columns if column != prediction],
            [contains("actual", "power"), contains("dc", "power"), contains("ac", "power"), lambda name: name in {"power", "power_output", "output", "generation"}, contains("power")],
        )

    return ColumnMapping(
        timestamp=_best_match(
            columns,
            [
                lambda name: name in {"timestamp", "datetime", "date_time", "date", "time"},
                contains("timestamp"),
                contains("date", "time"),
            ],
        ),
        irradiance=_best_match(
            columns,
            [
                contains("irradiance"),
                contains("radiation"),
                contains("solar", "irradiance"),
                lambda name: name in {"lux", "light", "light_level"},
                contains("lux"),
                contains("light"),
            ],
        ),
        temperature=_best_match(
            columns,
            [
                contains("module", "temperature"),
                contains("panel", "temperature"),
                contains("ambient", "temperature"),
                contains("temperature"),
                starts("temp"),
            ],
        ),
        voltage=_best_match(columns, [contains("voltage"), starts("volt")]),
        current=_best_match(columns, [contains("current"), contains("amperage"), lambda name: name in {"amp", "amps", "amperes"}]),
        power=power,
        prediction=prediction,
    )


def choose_primary_dataset(paths: list[Path]) -> tuple[Path, pd.DataFrame, ColumnMapping]:
    """Read candidates and choose the richest usable dataset deterministically."""
    candidates: list[tuple[int, int, Path, pd.DataFrame, ColumnMapping]] = []
    for path in paths:
        try:
            frame = read_tabular_file(path)
        except Exception as error:
            print(f"[IGNORED] {path}: could not read as a tabular dataset ({error})")
            continue
        if frame.empty or frame.columns.empty:
            print(f"[IGNORED] {path}: empty dataset")
            continue
        mapping = detect_columns(frame)
        measurement_count = sum(
            value is not None
            for name, value in mapping.as_dict().items()
            if name != "prediction"
        )
        # Prefer solar measurements; row count resolves otherwise similar files.
        candidates.append((measurement_count, len(frame), path, frame, mapping))

    if not candidates:
        raise RuntimeError("No readable non-empty CSV, Excel, JSON, or Parquet dataset was found.")
    _, _, path, frame, mapping = max(candidates, key=lambda item: (item[0], item[1], str(item[2])))
    return path, frame, mapping


def inspect_dataset(frame: pd.DataFrame, source: Path, mapping: ColumnMapping) -> str:
    """Print and return a textual dataset inspection report."""
    numeric = frame.select_dtypes(include=[np.number]).columns.tolist()
    categorical = [column for column in frame.columns if column not in numeric]
    lines = [
        f"Selected dataset: {source}",
        f"Rows: {len(frame)}",
        f"Columns: {len(frame.columns)}",
        "",
        "Column mapping:",
        *[f"  {key}: {value if value is not None else '[not detected]'}" for key, value in mapping.as_dict().items()],
        "",
        "Data types:",
        frame.dtypes.to_string(),
        "",
        "Missing values:",
        frame.isna().sum().to_string(),
        "",
        f"Numerical columns: {', '.join(numeric) if numeric else '[none]'}",
        f"Categorical/text columns: {', '.join(categorical) if categorical else '[none]'}",
    ]
    if numeric:
        lines.extend(["", "Numerical statistics:", frame[numeric].describe().to_string()])
    report = "\n".join(lines) + "\n"
    print(report)
    return report


def clean_dataset(frame: pd.DataFrame, mapping: ColumnMapping) -> tuple[pd.DataFrame, list[str]]:
    """Parse selected columns while preserving rows for plots that remain valid."""
    result = frame.copy()
    notes: list[str] = []

    for role in ("irradiance", "temperature", "voltage", "current", "power", "prediction"):
        column = getattr(mapping, role)
        if column is None:
            continue
        before = result[column].isna().sum()
        result[column] = pd.to_numeric(result[column], errors="coerce").replace([np.inf, -np.inf], np.nan)
        converted = int(result[column].isna().sum() - before)
        if converted > 0:
            notes.append(f"Converted {converted} non-numeric {role} value(s) to missing.")

    if mapping.timestamp is not None:
        result[mapping.timestamp] = pd.to_datetime(result[mapping.timestamp], errors="coerce", utc=True)
        invalid_times = int(result[mapping.timestamp].isna().sum())
        if invalid_times:
            notes.append(f"Timestamp parsing marked {invalid_times} value(s) as missing.")

    # Negative power, irradiance, voltage, and current are physically invalid for
    # this monitoring use case. Mark only these values missing; each plot drops
    # missing values locally so valid information for other graphs is retained.
    for role in ("irradiance", "voltage", "current", "power"):
        column = getattr(mapping, role)
        if column is None:
            continue
        negative = result[column] < 0
        if int(negative.sum()) > 0:
            result.loc[negative, column] = np.nan
            notes.append(f"Marked {int(negative.sum())} negative {role} value(s) as invalid.")

    if not notes:
        notes.append("No type-conversion or domain-invalid values were found in detected columns.")
    return result, notes


def _model_feature_order(model: Any, features_path: Path | None) -> list[str] | None:
    if features_path is not None:
        payload = json.loads(features_path.read_text(encoding="utf-8"))
        order = payload.get("feature_order") if isinstance(payload, dict) else None
        if isinstance(order, list) and all(isinstance(value, str) for value in order):
            return order
        raise ValueError("Feature-order JSON must contain a string list under 'feature_order'.")
    feature_names = getattr(model, "feature_names_in_", None)
    if feature_names is not None:
        return [str(value) for value in feature_names]
    return None


def add_optional_model_predictions(
    frame: pd.DataFrame,
    mapping: ColumnMapping,
    model_path: Path | None,
    features_path: Path | None,
) -> tuple[pd.DataFrame, ColumnMapping]:
    """Optionally create a prediction column from a compatible joblib model.

    This is deliberately opt-in. By default actual-vs-predicted plots require a
    prediction column already present in the dataset, avoiding accidental model
    assumptions or fabricated predictions.
    """
    if model_path is None:
        return frame, mapping
    if not model_path.exists():
        print(f"[SKIPPED] Optional model prediction — model file was not found: {model_path}")
        return frame, mapping

    try:
        import joblib

        model = joblib.load(model_path)
        order = _model_feature_order(model, features_path)
    except Exception as error:
        print(f"[SKIPPED] Optional model prediction — could not load model metadata ({error})")
        return frame, mapping
    if not order:
        print("[SKIPPED] Optional model prediction — provide --feature-order because the model has no feature_names_in_.")
        return frame, mapping

    direct_columns = {normalise_name(column): column for column in frame.columns}
    role_columns = {
        "lux": mapping.irradiance,
        "irradiance": mapping.irradiance,
        "temperature": mapping.temperature,
        "voltage": mapping.voltage,
        "current": mapping.current,
        "power": mapping.power,
    }
    values: dict[str, pd.Series] = {}
    unresolved: list[str] = []
    for feature in order:
        key = normalise_name(feature)
        source = direct_columns.get(key) or role_columns.get(key)
        if source is not None:
            values[feature] = pd.to_numeric(frame[source], errors="coerce")
        elif key in {"hour_sin", "hour_cos"} and mapping.timestamp is not None:
            timestamps = pd.to_datetime(frame[mapping.timestamp], errors="coerce", utc=True)
            hour = timestamps.dt.hour + timestamps.dt.minute / 60.0 + timestamps.dt.second / 3600.0
            angle = 2.0 * np.pi * hour / 24.0
            values[feature] = np.sin(angle) if key == "hour_sin" else np.cos(angle)
        else:
            unresolved.append(feature)
    if unresolved:
        print("[SKIPPED] Optional model prediction — required features could not be derived: " + ", ".join(unresolved))
        return frame, mapping

    feature_frame = pd.DataFrame(values, columns=order)
    valid = feature_frame.notna().all(axis=1)
    if not valid.any():
        print("[SKIPPED] Optional model prediction — no row has all required features.")
        return frame, mapping
    try:
        predicted = model.predict(feature_frame.loc[valid])
    except Exception as error:
        print(f"[SKIPPED] Optional model prediction — prediction failed ({error})")
        return frame, mapping
    if np.asarray(predicted).ndim != 1:
        print("[SKIPPED] Optional model prediction — model output is not a single predicted-power value.")
        return frame, mapping

    result = frame.copy()
    prediction_column = "model_predicted_power"
    result[prediction_column] = np.nan
    result.loc[valid, prediction_column] = np.asarray(predicted, dtype=float)
    print(f"[INFO] Added '{prediction_column}' from optional model: {model_path}")
    return result, replace(mapping, prediction=prediction_column)


def report_discovered_models(dataset_path: Path) -> None:
    """Explain opt-in model usage without automatically loading arbitrary pickles."""
    search_root = dataset_path if dataset_path.is_dir() else dataset_path.parent
    models = sorted(path for path in search_root.rglob("*.pkl") if "graphs" not in path.parts)
    if models:
        print("[INFO] Found model artifact(s). To generate optional predictions, pass --model and, when needed, --feature-order:")
        for model in models:
            print(f"       {model}")


def unit_label(column: str, role: str) -> str:
    """Return a report-friendly label while retaining the detected source name."""
    name = normalise_name(column)
    units = {
        "power": "W" if "power" in name or "output" in name else "",
        "voltage": "V",
        "current": "A",
        "temperature": "°C",
        "irradiance": "lux" if "lux" in name or "light" in name else "W/m²",
    }
    unit = units.get(role, "")
    return f"{column} ({unit})" if unit else column


def save_figure(figure: plt.Figure, output: Path) -> None:
    figure.tight_layout()
    figure.savefig(output, dpi=300, bbox_inches="tight")
    plt.close(figure)
    print(f"[SAVED] {output}")


def scatter_with_trend(
    frame: pd.DataFrame,
    x: str,
    y: str,
    x_label: str,
    y_label: str,
    title: str,
    output: Path,
) -> None:
    data = frame[[x, y]].dropna()
    figure, axis = plt.subplots(figsize=(8, 5.5))
    axis.scatter(data[x], data[y], alpha=0.65, s=22, color="#2563eb", edgecolors="none")
    if len(data) >= 3 and data[x].nunique() > 1:
        slope, intercept = np.polyfit(data[x], data[y], 1)
        x_values = np.linspace(float(data[x].min()), float(data[x].max()), 200)
        axis.plot(x_values, slope * x_values + intercept, color="#dc2626", linewidth=2, label="Linear trend")
        axis.legend()
    axis.set(title=title, xlabel=x_label, ylabel=y_label)
    axis.grid(alpha=0.3)
    save_figure(figure, output)


def require_columns(mapping: ColumnMapping, *roles: str) -> tuple[str, ...] | None:
    columns = tuple(getattr(mapping, role) for role in roles)
    return columns if all(column is not None for column in columns) else None


def plot_irradiance_vs_power(frame: pd.DataFrame, mapping: ColumnMapping, output: Path) -> bool:
    columns = require_columns(mapping, "irradiance", "power")
    if columns is None:
        print("[SKIPPED] Irradiance vs Power Output — no irradiance/light and power columns could be identified.")
        return False
    irradiance, power = columns
    scatter_with_trend(frame, irradiance, power, unit_label(irradiance, "irradiance"), unit_label(power, "power"), "Solar Irradiance vs Power Output", output / "irradiance_vs_power.png")
    return True


def plot_temperature_vs_power(frame: pd.DataFrame, mapping: ColumnMapping, output: Path) -> bool:
    columns = require_columns(mapping, "temperature", "power")
    if columns is None:
        print("[SKIPPED] Temperature vs Power Output — no temperature and power columns could be identified.")
        return False
    temperature, power = columns
    scatter_with_trend(frame, temperature, power, unit_label(temperature, "temperature"), unit_label(power, "power"), "Temperature vs Power Output", output / "temperature_vs_power.png")
    return True


def plot_voltage_vs_current(frame: pd.DataFrame, mapping: ColumnMapping, output: Path) -> bool:
    columns = require_columns(mapping, "voltage", "current")
    if columns is None:
        print("[SKIPPED] Voltage vs Current — no voltage/current columns could be identified.")
        return False
    voltage, current = columns
    scatter_with_trend(frame, voltage, current, unit_label(voltage, "voltage"), unit_label(current, "current"), "Voltage vs Current", output / "voltage_vs_current.png")
    return True


def plot_power_over_time(frame: pd.DataFrame, mapping: ColumnMapping, output: Path) -> bool:
    columns = require_columns(mapping, "timestamp", "power")
    if columns is None:
        print("[SKIPPED] Power Output over Time — no parseable timestamp and power columns could be identified.")
        return False
    timestamp, power = columns
    data = frame[[timestamp, power]].dropna().sort_values(timestamp)
    if data.empty:
        print("[SKIPPED] Power Output over Time — no valid timestamp/power rows remain after parsing.")
        return False
    figure, axis = plt.subplots(figsize=(10, 5.5))
    axis.plot(data[timestamp], data[power], color="#2563eb", linewidth=1.2)
    axis.set(title="Power Output over Time", xlabel="Timestamp (UTC)", ylabel=unit_label(power, "power"))
    axis.xaxis.set_major_locator(mdates.AutoDateLocator())
    axis.xaxis.set_major_formatter(mdates.ConciseDateFormatter(axis.xaxis.get_major_locator()))
    axis.grid(alpha=0.3)
    save_figure(figure, output / "power_over_time.png")
    return True


def plot_irradiance_vs_temperature(frame: pd.DataFrame, mapping: ColumnMapping, output: Path) -> bool:
    columns = require_columns(mapping, "irradiance", "temperature")
    if columns is None:
        print("[SKIPPED] Irradiance vs Temperature — no irradiance/light and temperature columns could be identified.")
        return False
    irradiance, temperature = columns
    scatter_with_trend(frame, irradiance, temperature, unit_label(irradiance, "irradiance"), unit_label(temperature, "temperature"), "Solar Irradiance vs Temperature", output / "irradiance_vs_temperature.png")
    return True


def plot_power_distribution(frame: pd.DataFrame, mapping: ColumnMapping, output: Path) -> bool:
    power = mapping.power
    if power is None:
        print("[SKIPPED] Power Output Distribution — no power column could be identified.")
        return False
    data = frame[power].dropna()
    if data.empty:
        print("[SKIPPED] Power Output Distribution — no valid power values remain after cleaning.")
        return False
    bins = min(50, max(10, int(math.ceil(math.sqrt(len(data))))))
    figure, axis = plt.subplots(figsize=(8, 5.5))
    sns.histplot(data, bins=bins, kde=data.nunique() > 1, color="#2563eb", edgecolor="white", ax=axis)
    axis.set(title="Power Output Distribution", xlabel=unit_label(power, "power"), ylabel="Count")
    axis.grid(axis="y", alpha=0.3)
    save_figure(figure, output / "power_distribution.png")
    return True


def plot_correlation_heatmap(frame: pd.DataFrame, mapping: ColumnMapping, output: Path) -> tuple[bool, pd.DataFrame]:
    relevant = [column for column in mapping.as_dict().values() if column is not None]
    numeric = [column for column in dict.fromkeys(relevant) if pd.api.types.is_numeric_dtype(frame[column])]
    if len(numeric) < 2:
        print("[SKIPPED] Correlation Heatmap — fewer than two relevant numeric variables are available.")
        return False, pd.DataFrame()
    correlation = frame[numeric].corr(numeric_only=True)
    figure, axis = plt.subplots(figsize=(max(7, len(numeric) * 1.15), max(5.5, len(numeric) * 0.9)))
    sns.heatmap(correlation, annot=True, fmt=".2f", cmap="coolwarm", center=0, square=True, linewidths=0.5, cbar_kws={"label": "Pearson correlation"}, ax=axis)
    axis.set_title("Correlation Heatmap of Detected Solar Measurements")
    save_figure(figure, output / "correlation_heatmap.png")
    return True, correlation


def plot_actual_vs_predicted(frame: pd.DataFrame, mapping: ColumnMapping, output: Path) -> tuple[bool, dict[str, float]]:
    columns = require_columns(mapping, "power", "prediction")
    if columns is None:
        print("[SKIPPED] Actual vs Predicted Power — no measured power plus prediction/forecast column was identified.")
        return False, {}
    actual, predicted = columns
    data = frame[[actual, predicted]].dropna()
    if data.empty:
        print("[SKIPPED] Actual vs Predicted Power — no valid actual/predicted rows remain after cleaning.")
        return False, {}
    mae = float(np.mean(np.abs(data[actual] - data[predicted])))
    rmse = float(np.sqrt(np.mean((data[actual] - data[predicted]) ** 2)))
    ss_res = float(np.sum((data[actual] - data[predicted]) ** 2))
    ss_tot = float(np.sum((data[actual] - data[actual].mean()) ** 2))
    r2 = float(1.0 - ss_res / ss_tot) if ss_tot > 0 else float("nan")

    lower = min(float(data[actual].min()), float(data[predicted].min()))
    upper = max(float(data[actual].max()), float(data[predicted].max()))
    figure, axis = plt.subplots(figsize=(7, 6))
    axis.scatter(data[actual], data[predicted], alpha=0.65, s=24, color="#2563eb", edgecolors="none")
    axis.plot([lower, upper], [lower, upper], "--", color="#dc2626", linewidth=2, label="Ideal: y = x")
    axis.set(title="Actual vs Predicted Power", xlabel=f"Actual {unit_label(actual, 'power')}", ylabel=f"Predicted {unit_label(predicted, 'power')}")
    axis.legend()
    axis.grid(alpha=0.3)
    save_figure(figure, output / "actual_vs_predicted_power.png")
    return True, {"mae": mae, "rmse": rmse, "r2": r2}


def write_summary(
    output: Path,
    inspection: str,
    notes: list[str],
    generated: list[str],
    correlation: pd.DataFrame,
    prediction_metrics: dict[str, float],
) -> None:
    lines = [inspection.rstrip(), "", "Preprocessing decisions:", *[f"- {note}" for note in notes], "", "Generated graphs:"]
    lines.extend(f"- {name}" for name in generated) if generated else lines.append("- None")
    if prediction_metrics:
        lines.extend(["", "Actual vs predicted metrics:", *[f"- {key.upper()}: {value:.6f}" for key, value in prediction_metrics.items()]])
    if not correlation.empty:
        lines.extend(["", "Correlation matrix:", correlation.to_string()])
        correlation.to_csv(output / "correlations.csv")
        print(f"[SAVED] {output / 'correlations.csv'}")
    (output / "analysis_summary.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"[SAVED] {output / 'analysis_summary.txt'}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate engineering analysis graphs from a solar telemetry dataset.")
    parser.add_argument("dataset_path", nargs="?", type=Path, default=DEFAULT_DATA_DIR, help=f"Dataset file or folder (default: {DEFAULT_DATA_DIR})")
    parser.add_argument("--output", type=Path, default=None, help="Directory for PNG graphs and summaries (default: model/graphs for the bundled dataset; otherwise <dataset_path>/graphs)")
    parser.add_argument("--model", type=Path, default=None, help="Optional compatible joblib model used to create a predicted-power column.")
    parser.add_argument("--feature-order", type=Path, default=None, help="Optional JSON file containing {'feature_order': [...]} for --model.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    dataset_path = args.dataset_path.expanduser().resolve()
    default_output = (
        Path(__file__).resolve().parent / "graphs"
        if dataset_path == DEFAULT_DATA_DIR.resolve()
        else (dataset_path.parent if dataset_path.is_file() else dataset_path) / "graphs"
    )
    output = (args.output or default_output).expanduser().resolve()
    output.mkdir(parents=True, exist_ok=True)
    sns.set_theme(style="whitegrid", rc=PLOT_STYLE)

    try:
        selected, raw, mapping = choose_primary_dataset(discover_datasets(dataset_path))
    except (FileNotFoundError, RuntimeError, ValueError) as error:
        print(f"[ERROR] {error}", file=sys.stderr)
        return 1

    inspection = inspect_dataset(raw, selected, mapping)
    cleaned, notes = clean_dataset(raw, mapping)
    if args.model is not None:
        cleaned, mapping = add_optional_model_predictions(
            cleaned,
            mapping,
            args.model.expanduser().resolve(),
            args.feature_order.expanduser().resolve() if args.feature_order else None,
        )
    else:
        report_discovered_models(dataset_path)
    print("Detected mapping:", json.dumps(mapping.as_dict(), indent=2))

    graph_functions: list[tuple[str, Callable[[], bool]]] = [
        ("irradiance_vs_power.png", lambda: plot_irradiance_vs_power(cleaned, mapping, output)),
        ("temperature_vs_power.png", lambda: plot_temperature_vs_power(cleaned, mapping, output)),
        ("voltage_vs_current.png", lambda: plot_voltage_vs_current(cleaned, mapping, output)),
        ("power_over_time.png", lambda: plot_power_over_time(cleaned, mapping, output)),
        ("irradiance_vs_temperature.png", lambda: plot_irradiance_vs_temperature(cleaned, mapping, output)),
        ("power_distribution.png", lambda: plot_power_distribution(cleaned, mapping, output)),
    ]
    generated = [name for name, function in graph_functions if function()]
    heatmap_created, correlation = plot_correlation_heatmap(cleaned, mapping, output)
    if heatmap_created:
        generated.append("correlation_heatmap.png")
    predictions_created, prediction_metrics = plot_actual_vs_predicted(cleaned, mapping, output)
    if predictions_created:
        generated.append("actual_vs_predicted_power.png")
    write_summary(output, inspection, notes, generated, correlation, prediction_metrics)
    print(f"[DONE] Analysis artifacts saved to: {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
