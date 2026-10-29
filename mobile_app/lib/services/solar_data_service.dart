import 'dart:async';

import 'package:flutter/foundation.dart';

import '../models/analysis_snapshot.dart';
import '../models/live_readings.dart';
import '../models/onboarding_slide.dart';
import '../models/service_models.dart';
import '../models/solar_panel.dart';
import '../models/system_summary.dart';
import '../models/user_profile.dart';
import 'auth_service.dart';
import 'backend_api.dart';
import 'historical_telemetry_service.dart';
import 'notification_service.dart';
import 'settings_service.dart';

/// Shared source for authenticated backend data.
class SolarDataService extends ChangeNotifier {
  SolarDataService._();
  static final SolarDataService instance = SolarDataService._();

  final BackendApi _api = BackendApi();
  Map<String, dynamic>? _live;
  Map<String, dynamic>? _prediction;
  Map<String, dynamic>? _expectedPower;
  Map<String, dynamic>? _diagnostics;
  Map<String, dynamic>? _maintenance;
  List<Map<String, dynamic>>? _panels;
  List<Map<String, dynamic>>? _alerts;
  List<Map<String, dynamic>>? _serviceHistory;
  List<Map<String, dynamic>>? _powerHistory;
  final DateTime _sessionStartedAt = DateTime.now();
  final List<PowerSample> _sessionPowerSamples = [];
  String? _backendError;
  bool _refreshing = false;
  Set<String>? _knownAlertKeys;
  Future<List<HistoricalTelemetryPoint>>? _historicalTelemetryFuture;
  final Map<String, List<Map<String, dynamic>>> _analysisHistory = {};
  final Set<String> _analysisLoadingRanges = {};
  final Map<String, String> _analysisErrors = {};

  bool get backendConnected =>
      _live != null || _panels != null || _maintenance != null;
  bool get hasLiveData => _live != null;
  bool get isRefreshing => _refreshing;
  String? get backendError => _backendError;
  DateTime? get backendUpdatedAt =>
      DateTime.tryParse(_live?['timestamp']?.toString() ?? '');
  List<Map<String, dynamic>> get alerts => _alerts ?? const [];

  bool get hasBackendPanelData => _panels != null;
  bool get hasBackendServiceHistory => _serviceHistory != null;
  bool get hasBackendAlerts => _alerts != null;
  bool get hasExpectedPower => _expectedPower?['expected_power'] is num;

  List<MaintenanceTask> getMaintenancePlan() {
    final maintenance = _maintenance;
    if (maintenance == null) return const [];
    final days = maintenance['days_remaining'];
    final nextDate = _text(maintenance['next_service_date'], 'Not scheduled');
    final recommendation =
        _text(maintenance['recommendation'], 'No recommendation available.');
    return [
      MaintenanceTask(
        title: recommendation,
        subtitle: days is num ? 'Due in ${days} days · $nextDate' : nextDate,
        state: days is num && days <= 0
            ? MaintenanceState.recommended
            : MaintenanceState.upcoming,
      ),
    ];
  }

  List<ServiceRecord> getServiceHistory() {
    if (_serviceHistory == null) return const [];
    return _serviceHistory!.map((record) {
      final title = _text(
          record['task_name'] ??
              record['title'] ??
              record['task_type'] ??
              record['type'],
          'Maintenance');
      final status = _text(record['status'], 'Scheduled');
      final date = _text(
          record['scheduled_date'] ?? record['created_at'] ?? record['date'],
          'Date unavailable');
      final details = _text(record['description'] ?? record['notes'], '');
      return ServiceRecord(
        title: title,
        dateLabel: '$date · $status',
        description: details,
        completed: status.toLowerCase() == 'completed',
      );
    }).toList();
  }

  Future<void> refreshFromBackend() async {
    if (_refreshing || await AuthService.instance.accessToken == null) return;
    _refreshing = true;
    _backendError = null;
    notifyListeners();

    Future<void> load(String path, void Function(dynamic) accept,
        {Map<String, String> query = const {}}) async {
      try {
        accept(await _api.get(path, query: query));
      } catch (error) {
        _backendError ??= error.toString();
      }
    }

    await Future.wait([
      load('/api/live', (value) {
        _live = value is Map ? Map<String, dynamic>.from(value) : null;
        if (_live != null) _recordPowerSample(_live!);
      }),
      load('/api/predictions', (value) {
        _prediction = value is Map ? Map<String, dynamic>.from(value) : null;
      }),
      load('/api/expected-power', (value) {
        _expectedPower = value is Map ? Map<String, dynamic>.from(value) : null;
      }),
      load('/api/diagnostics', (value) {
        _diagnostics = value is Map ? Map<String, dynamic>.from(value) : null;
      }),
      load('/api/maintenance', (value) {
        _maintenance = value is Map ? Map<String, dynamic>.from(value) : null;
      }),
      load('/api/panels', (value) {
        _panels = value is List
            ? value.whereType<Map>().map(Map<String, dynamic>.from).toList()
            : <Map<String, dynamic>>[];
      }),
      load('/api/alerts', (value) {
        final rows = value is Map ? value['alerts'] : null;
        final fetched = rows is List
            ? rows.whereType<Map>().map(Map<String, dynamic>.from).toList()
            : <Map<String, dynamic>>[];
        final active = fetched.where((alert) => alert['resolved'] != true);
        final alertKeys = active.map(_alertKey).toSet();
        if (_knownAlertKeys != null &&
            SettingsService.instance.criticalAlerts) {
          final newAlerts = active
              .where((alert) => !_knownAlertKeys!.contains(_alertKey(alert)));
          for (final alert in newAlerts) {
            unawaited(NotificationService.showAlert(alert));
          }
        }
        _knownAlertKeys = alertKeys;
        _alerts = fetched;
      }),
      load('/api/service-history', (value) {
        _serviceHistory = value is List
            ? value.whereType<Map>().map(Map<String, dynamic>.from).toList()
            : <Map<String, dynamic>>[];
      }),
      load('/api/history', (value) {
        final rows = value is Map ? value['data'] : null;
        _powerHistory = rows is List
            ? rows.whereType<Map>().map(Map<String, dynamic>.from).toList()
            : <Map<String, dynamic>>[];
      }, query: {
        'field': 'power',
        'start': DateTime.now()
            .toUtc()
            .subtract(const Duration(hours: 24))
            .toIso8601String(),
        'end': DateTime.now().toUtc().toIso8601String(),
      }),
    ]);

    _refreshing = false;
    notifyListeners();
  }

  String _alertKey(Map<String, dynamic> alert) =>
      '${alert['id'] ?? ''}|${alert['timestamp'] ?? ''}|${alert['type'] ?? ''}|${alert['device_id'] ?? ''}';

  Future<Map<String, dynamic>?> getHardwareStatus({String? deviceId}) async {
    final query = deviceId == null || deviceId.isEmpty
        ? const <String, String>{}
        : {'device_id': deviceId};
    final result = await _api.get('/api/hardware-status', query: query);
    return result is Map ? Map<String, dynamic>.from(result) : null;
  }

  void clearBackendData() {
    _live = null;
    _prediction = null;
    _expectedPower = null;
    _diagnostics = null;
    _maintenance = null;
    _panels = null;
    _alerts = null;
    _knownAlertKeys = null;
    _serviceHistory = null;
    _powerHistory = null;
    _sessionPowerSamples.clear();
    _analysisHistory.clear();
    _backendError = null;
    notifyListeners();
  }

  double _number(dynamic value, [double fallback = 0]) =>
      value is num ? value.toDouble() : double.tryParse('$value') ?? fallback;

  String _text(dynamic value, [String fallback = '']) =>
      value == null ? fallback : value.toString();

  UserProfile get profile {
    final name = AuthService.instance.displayName;
    if (name != null && name.isNotEmpty) {
      return UserProfile(
        firstName: name.split(RegExp(r'\s+')).first,
        fullName: name,
        note: AuthService.instance.email ?? 'Connected account',
      );
    }
    return const UserProfile(firstName: 'there', fullName: 'Account', note: '');
  }

  List<OnboardingSlide> get onboardingSlides => const [
        OnboardingSlide(
          kicker: 'Welcome to SolarShield',
          titleStart: 'Smart solar for a ',
          titleEmphasis: 'brighter tomorrow.',
          body:
              'See the health and performance of your complete rooftop system from one calm, connected workspace.',
          features: ['Live overview', 'Panel health', 'Clear alerts'],
          imageUrl:
              'https://images.unsplash.com/photo-1611365892117-00ac5ef43c90?auto=format&fit=crop&q=88&w=1400',
        ),
        OnboardingSlide(
          kicker: 'Live system visibility',
          titleStart: 'Know what every ',
          titleEmphasis: 'panel is doing.',
          body:
              'Follow measured power, voltage, temperature, irradiance, and sensor connectivity as conditions change.',
          features: ['Live power', 'Weather context', 'Panel status'],
          imageUrl:
              'https://images.unsplash.com/photo-1698752821934-28bd5ce6fd42?auto=format&fit=crop&q=88&w=1400',
        ),
        OnboardingSlide(
          kicker: 'Predict problems early',
          titleStart: 'Smarter insights. ',
          titleEmphasis: 'Fewer surprises.',
          body:
              'Compare actual output with model estimates, understand efficiency trends, and catch maintenance signals sooner.',
          features: ['Trend analysis', 'Fault signals', 'Service planning'],
          imageUrl:
              'https://images.unsplash.com/photo-1789676965156-f880587af2c7?auto=format&fit=crop&q=88&w=1400',
        ),
        OnboardingSlide(
          kicker: 'Your solar system, connected',
          titleStart: 'Ready to power ',
          titleEmphasis: 'your dashboard?',
          body:
              'Access monitoring, analysis, and maintenance tools for your connected solar system.',
          features: ['Private dashboard', 'Saved preferences', 'Secure-ready'],
          imageUrl:
              'https://images.unsplash.com/photo-1726221062287-fda475b85493?auto=format&fit=crop&q=88&w=1400',
        ),
      ];

  SystemSummary getSystemSummary() {
    if (_live != null || _panels != null || _prediction != null) {
      final panels = getPanels();
      final knownHealth = panels.where((p) => p.health != PanelHealth.unknown);
      final alerts = _alerts ?? [];
      final history = _powerHistory ?? [];
      final watts = history.map((row) => _number(row['value'])).toList();
      final energy = history.length > 1
          ? history.skip(1).toList().asMap().entries.fold<double>(0,
              (sum, entry) {
              final previous = DateTime.tryParse(
                  history[entry.key]['timestamp']?.toString() ?? '');
              final current =
                  DateTime.tryParse(entry.value['timestamp']?.toString() ?? '');
              if (previous == null || current == null) return sum;
              final hours = current.difference(previous).inSeconds / 3600;
              return sum +
                  ((_number(history[entry.key]['value']) +
                              _number(entry.value['value'])) /
                          2 /
                          1000) *
                      hours;
            })
          : 0.0;
      final diagnosis = _diagnostics ?? {};
      final expectedPower = _number(_expectedPower?['expected_power']);
      final actualPower = _number(_expectedPower?['actual_power']);
      final actualCapacity =
          panels.fold<double>(0, (sum, panel) => sum + panel.powerKw);
      return SystemSummary(
        totalPanels: panels.length,
        healthyPanels:
            knownHealth.where((p) => p.health == PanelHealth.healthy).length,
        watchPanels:
            knownHealth.where((p) => p.health != PanelHealth.healthy).length,
        capacityKw: actualCapacity,
        efficiencyPercent: _number(_prediction?['efficiency_score']),
        energyTodayKwh: energy,
        vsExpectedPercent:
            expectedPower > 0 ? (actualPower / expectedPower - 1) * 100 : 0,
        activeAlerts: alerts.where((alert) => alert['resolved'] != true).length,
        diagnosisTitle: _text(diagnosis['health'], 'Awaiting diagnosis'),
        diagnosisMessage: _text(diagnosis['recommendation'],
            'No diagnostic recommendation is available.'),
        hourlyProduction: _normalize(watts),
      );
    }
    return const SystemSummary(
      totalPanels: 0,
      healthyPanels: 0,
      watchPanels: 0,
      capacityKw: 0,
      efficiencyPercent: 0,
      energyTodayKwh: 0,
      vsExpectedPercent: 0,
      activeAlerts: 0,
      diagnosisTitle: 'No system data',
      diagnosisMessage: 'Connect an account with an assigned solar system.',
      hourlyProduction: [],
    );
  }

  LiveReadings getLiveReadings() {
    if (_live != null) {
      final voltage = _number(_live!['voltage']);
      final current = _number(_live!['current']);
      final watts = voltage * current;
      return LiveReadings(
        powerKw: watts / 1000,
        powerWatts: watts,
        voltageV: voltage,
        currentA: current,
        panelTempC: _number(_live!['temperature']),
        irradianceWm2: _number(_live!['lux']),
        humidityPercent: _number(_live!['humidity']).round(),
        lastUpdated:
            DateTime.tryParse(_text(_live!['timestamp'])) ?? DateTime.now(),
        powerSamples: List.unmodifiable(_sessionPowerSamples),
        sessionStartedAt: _sessionStartedAt,
      );
    }
    return LiveReadings(
      powerKw: 0,
      powerWatts: 0,
      voltageV: 0,
      currentA: 0,
      panelTempC: 0,
      irradianceWm2: 0,
      humidityPercent: 0,
      lastUpdated: DateTime.fromMillisecondsSinceEpoch(0),
      powerSamples: List.unmodifiable(_sessionPowerSamples),
      sessionStartedAt: _sessionStartedAt,
    );
  }

  void _recordPowerSample(Map<String, dynamic> reading) {
    final voltage = reading['voltage'];
    final current = reading['current'];
    if (voltage is! num || current is! num) return;

    _sessionPowerSamples.add(PowerSample(
      observedAt: DateTime.now(),
      powerWatts: voltage.toDouble() * current.toDouble(),
    ));
  }

  List<double> _normalize(List<double> values) {
    if (values.isEmpty) return const [];
    final maxValue = values.reduce((a, b) => a > b ? a : b);
    if (maxValue <= 0) return List.filled(values.length, 0);
    return values.map((value) => value / maxValue * 100).toList();
  }

  List<Offset2> _curve(List<double> values) {
    if (values.length < 2) return const [Offset2(0, 100), Offset2(330, 100)];
    final normalized = _normalize(values);
    return [
      for (var i = 0; i < normalized.length; i++)
        Offset2(i * 330 / (normalized.length - 1), 120 - normalized[i] * 1.05),
    ];
  }

  List<SolarPanel> getPanels() {
    if (_panels != null) {
      return _panels!.map((panel) {
        final status = _text(panel['health'] ?? panel['status']).toLowerCase();
        final health = status.contains('fault') || status.contains('damaged')
            ? PanelHealth.fault
            : status.contains('watch') || status.contains('attention')
                ? PanelHealth.watch
                : status.contains('healthy') || status == 'normal'
                    ? PanelHealth.healthy
                    : PanelHealth.unknown;
        return SolarPanel(
          name: _text(panel['name'], 'Solar panel'),
          deviceId: _text(panel['esp32_id'] ?? panel['device_id']).isEmpty
              ? null
              : _text(panel['esp32_id'] ?? panel['device_id']),
          powerKw: _number(panel['rated_power']) / 1000,
          temperatureC: null,
          health: health,
        );
      }).toList();
    }
    return const [];
  }

  static const List<String> analysisRanges = ['24H', '7D', '30D', 'YTD'];

  AnalysisSnapshot getAnalysis(String range) {
    final rows = _analysisHistory[range];
    if (rows != null && rows.isNotEmpty) {
      final values = rows.map((row) => _number(row['value'])).toList();
      final timestamps = rows
          .map((row) => DateTime.tryParse(_text(row['timestamp'])))
          .toList();
      var energy = 0.0;
      for (var i = 1; i < values.length; i++) {
        final previous = timestamps[i - 1];
        final current = timestamps[i];
        if (previous != null && current != null) {
          energy += (values[i - 1] + values[i]) /
              2 /
              1000 *
              current.difference(previous).inSeconds /
              3600;
        }
      }
      final split = values.length ~/ 2;
      final earlier = values.take(split).toList();
      final recent = values.skip(split).toList();
      final earlierAverage = earlier.isEmpty
          ? 0.0
          : earlier.reduce((sum, value) => sum + value) / earlier.length;
      final recentAverage =
          recent.reduce((sum, value) => sum + value) / recent.length;
      final changePercent = earlierAverage == 0
          ? 0.0
          : (recentAverage - earlierAverage) / earlierAverage * 100;
      final validTimestamps = timestamps.whereType<DateTime>().toList();
      final middleTimestamp = validTimestamps[validTimestamps.length ~/ 2];
      final axisLabels = [
        _axisLabel(validTimestamps.first, range),
        _axisLabel(middleTimestamp, range),
        _axisLabel(validTimestamps.last, range),
      ];
      return AnalysisSnapshot(
        range: range,
        energyKwh: energy,
        changePercent: changePercent,
        averagePowerWatts:
            values.reduce((sum, value) => sum + value) / values.length,
        bars: _normalize(values),
        axisLabels: axisLabels,
        comparisonNote: 'Bundled telemetry CSV · ${rows.length} readings · '
            '${_axisDate(validTimestamps.first)} to '
            '${_axisDate(validTimestamps.last)}.',
        actualCurve: _curve(values),
        expectedCurve: const [],
        degradationLabel: 'Not included in this telemetry dataset',
        degradationStatus: 'Unavailable',
      );
    }
    return AnalysisSnapshot(
      range: range,
      energyKwh: 0,
      changePercent: 0,
      averagePowerWatts: 0,
      bars: const [],
      axisLabels: const [],
      comparisonNote: analysisLoadError(range) ??
          'No readings are available for this range in the bundled CSV.',
      actualCurve: const [],
      expectedCurve: const [],
      degradationLabel: 'Not included in this telemetry dataset',
      degradationStatus: 'Unavailable',
    );
  }

  Future<void> loadAnalysis(String range) async {
    _analysisLoadingRanges.add(range);
    _analysisErrors.remove(range);
    notifyListeners();
    try {
      final readings = await (_historicalTelemetryFuture ??=
          HistoricalTelemetryService.load());
      if (readings.isEmpty) {
        _analysisHistory[range] = [];
        return;
      }

      // These ranges end at the most recent date in the bundled dataset,
      // rather than today's date, so the static data remains useful over time.
      final end = readings.last.timestamp;
      final start = switch (range) {
        '24H' => end.subtract(const Duration(hours: 24)),
        '30D' => end.subtract(const Duration(days: 30)),
        'YTD' => DateTime.utc(end.year, 1, 1),
        _ => end.subtract(const Duration(days: 7)),
      };
      _analysisHistory[range] = readings
          .where((point) =>
              !point.timestamp.isBefore(start) && !point.timestamp.isAfter(end))
          .map((point) => <String, dynamic>{
                'timestamp': point.timestamp.toIso8601String(),
                'value': point.powerWatts,
              })
          .toList();
    } catch (error) {
      _historicalTelemetryFuture = null;
      _analysisErrors[range] = error.toString();
    } finally {
      _analysisLoadingRanges.remove(range);
      notifyListeners();
    }
  }

  bool hasAnalysisHistory(String range) =>
      _analysisHistory[range]?.isNotEmpty ?? false;

  bool isAnalysisLoading(String range) =>
      _analysisLoadingRanges.contains(range);

  String? analysisLoadError(String range) => _analysisErrors[range];

  String _axisLabel(DateTime date, String range) {
    final local = date.toLocal();
    if (range == '24H') {
      return '${local.hour.toString().padLeft(2, '0')}:'
          '${local.minute.toString().padLeft(2, '0')}';
    }
    return '${local.day.toString().padLeft(2, '0')} '
        '${_monthNames[local.month - 1]}';
  }

  String _axisDate(DateTime date) {
    final local = date.toLocal();
    return '${local.day.toString().padLeft(2, '0')} '
        '${_monthNames[local.month - 1]} ${local.year}';
  }

  static const _monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  List<String> get serviceTypes =>
      const ['Panel cleaning', 'Performance check', 'Fault inspection'];
}
