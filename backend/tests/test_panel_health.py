from diagnostics import run_diagnostics
from diagnostics.panel_health import evaluate_panel_health


def test_panel_health_uses_panel_specific_ratings():
    panel_config = {
        "rated_voltage": 40.0,
        "rated_current": 8.0,
    }

    assert evaluate_panel_health({"voltage": 24.0, "current": 6.0}, panel_config) == "degraded"
    assert evaluate_panel_health({"voltage": 20.0, "current": 6.0}, panel_config) == "critical_underperformance"
    assert evaluate_panel_health({"voltage": 44.0, "current": 9.0}, panel_config) == "overcurrent_risk"
    assert evaluate_panel_health({"voltage": 34.0, "current": 7.0}, panel_config) == "normal"


def test_diagnostics_uses_expected_power_baseline_not_saved_ratings():
    result = run_diagnostics(
        latest_telemetry={
            "voltage": 24.0,
            "current": 6.0,
            "power": 144.0,
            "lux": 50000.0,
            "temperature": 25.0,
            "humidity": 50.0,
        },
        baseline={
            "expected_power": 200.0,
            "performance_ratio": 0.72,
            "operational_status": "Underperforming",
        },
    )

    assert result.health == "Degraded"
    assert result.root_cause == "Low-output anomaly"
