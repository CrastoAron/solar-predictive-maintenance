import 'live_readings.dart';

class AnalysisSnapshot {
  final String range;
  final double energyKwh;
  final double changePercent;
  final double averagePowerWatts;
  final List<double> bars; // 0..100
  final List<String> axisLabels; // 3 labels
  final String comparisonNote;
  final List<Offset2> actualCurve; // 330 x 115 space
  final List<Offset2> expectedCurve;
  final String degradationLabel;
  final String degradationStatus;

  const AnalysisSnapshot({
    required this.range,
    required this.energyKwh,
    required this.changePercent,
    required this.averagePowerWatts,
    required this.bars,
    required this.axisLabels,
    required this.comparisonNote,
    required this.actualCurve,
    required this.expectedCurve,
    required this.degradationLabel,
    required this.degradationStatus,
  });
}
