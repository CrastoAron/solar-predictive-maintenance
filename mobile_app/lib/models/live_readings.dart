/// Tiny framework-free point type so models don't depend on Flutter.
class Offset2 {
  final double x;
  final double y;
  const Offset2(this.x, this.y);
}

class PowerSample {
  final DateTime observedAt;
  final double powerWatts;

  const PowerSample({required this.observedAt, required this.powerWatts});
}

String formatPower(double watts) => watts >= 1000
    ? '${(watts / 1000).toStringAsFixed(2)} kW'
    : '${watts.toStringAsFixed(1)} W';

class LiveReadings {
  final double powerKw;
  final double powerWatts;
  final double voltageV;
  final double currentA;
  final double panelTempC;
  final double irradianceWm2;
  final int humidityPercent;
  final DateTime lastUpdated;

  final List<PowerSample> powerSamples;
  final DateTime sessionStartedAt;

  const LiveReadings({
    required this.powerKw,
    required this.powerWatts,
    required this.voltageV,
    required this.currentA,
    required this.panelTempC,
    required this.irradianceWm2,
    required this.humidityPercent,
    required this.lastUpdated,
    required this.powerSamples,
    required this.sessionStartedAt,
  });
}
