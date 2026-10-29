enum PanelHealth { healthy, watch, fault, unknown }

class SolarPanel {
  final String name;
  final String? deviceId;
  final double powerKw;
  final double? temperatureC;
  final PanelHealth health;

  const SolarPanel({
    required this.name,
    this.deviceId,
    required this.powerKw,
    required this.temperatureC,
    required this.health,
  });

  String get healthLabel {
    switch (health) {
      case PanelHealth.healthy:
        return 'Healthy';
      case PanelHealth.watch:
        return 'Watch';
      case PanelHealth.fault:
        return 'Fault';
      case PanelHealth.unknown:
        return 'Status unavailable';
    }
  }

  String get summary => temperatureC == null
      ? '${powerKw.toStringAsFixed(1)} kW rated output'
      : '${powerKw.toStringAsFixed(1)} kW · ${temperatureC!.toStringAsFixed(1)}°C';
}
