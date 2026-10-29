class SystemSummary {
  final int totalPanels;
  final int healthyPanels;
  final int watchPanels;
  final double capacityKw;
  final double efficiencyPercent;
  final double energyTodayKwh;
  final double vsExpectedPercent;
  final int activeAlerts;
  final String diagnosisTitle;
  final String diagnosisMessage;
  final List<double> hourlyProduction; // 0..100 relative heights

  const SystemSummary({
    required this.totalPanels,
    required this.healthyPanels,
    required this.watchPanels,
    required this.capacityKw,
    required this.efficiencyPercent,
    required this.energyTodayKwh,
    required this.vsExpectedPercent,
    required this.activeAlerts,
    required this.diagnosisTitle,
    required this.diagnosisMessage,
    required this.hourlyProduction,
  });
}
