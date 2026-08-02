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
