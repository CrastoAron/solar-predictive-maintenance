from routers.maintenance import _active_alert_summary, _alert_maintenance_days


def test_high_active_alert_requires_immediate_maintenance():
    count, severity, message = _active_alert_summary(
        [
            {"severity": "medium", "message": "Efficiency is low", "resolved": False},
            {"severity": "high", "message": "Sensor fault", "resolved": False},
            {"severity": "high", "message": "Old resolved fault", "resolved": True},
        ]
    )

    assert count == 1
    assert severity == "high"
    assert message == "Sensor fault"
    assert _alert_maintenance_days(45, severity) == 0


def test_resolved_alerts_do_not_change_the_schedule():
    count, severity, message = _active_alert_summary(
        [{"severity": "high", "message": "Resolved", "resolved": True}]
    )

    assert (count, severity, message) == (0, None, None)
    assert _alert_maintenance_days(45, severity) == 45
