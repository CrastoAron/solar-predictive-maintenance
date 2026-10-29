import 'package:flutter/services.dart';

class HistoricalTelemetryPoint {
  final DateTime timestamp;
  final double voltage;
  final double current;
  final double powerWatts;
  final double lux;
  final double temperature;
  final double humidity;

  const HistoricalTelemetryPoint({
    required this.timestamp,
    required this.voltage,
    required this.current,
    required this.powerWatts,
    required this.lux,
    required this.temperature,
    required this.humidity,
  });
}

class HistoricalTelemetryService {
  HistoricalTelemetryService._();

  static Future<List<HistoricalTelemetryPoint>>? _loadFuture;

  static Future<List<HistoricalTelemetryPoint>> load() =>
      _loadFuture ??= _readAsset();

  static Future<List<HistoricalTelemetryPoint>> _readAsset() async {
    final csv =
        await rootBundle.loadString('assets/cleaned_real_telemetry.csv');
    final rows = _parseCsv(csv);
    if (rows.isEmpty) return const [];

    final headers = rows.first;
    final columns = {for (var i = 0; i < headers.length; i++) headers[i]: i};

    String value(List<String> row, String column) {
      final index = columns[column];
      return index == null || index >= row.length ? '' : row[index].trim();
    }

    double number(List<String> row, String column) {
      final parsed = double.tryParse(value(row, column));
      if (parsed == null || !parsed.isFinite) {
        throw FormatException('Invalid $column value in telemetry CSV');
      }
      return parsed;
    }

    final points = <HistoricalTelemetryPoint>[];
    for (final row in rows.skip(1)) {
      if (row.isEmpty || row.every((field) => field.trim().isEmpty)) continue;
      final quality = value(row, 'quality_flag');
      if (quality.isNotEmpty && quality != 'OK') continue;
      points.add(HistoricalTelemetryPoint(
        timestamp: DateTime.parse(value(row, 'timestamp')).toUtc(),
        voltage: number(row, 'voltage'),
        current: number(row, 'current'),
        powerWatts: number(row, 'power'),
        lux: number(row, 'lux'),
        temperature: number(row, 'temperature'),
        humidity: number(row, 'humidity'),
      ));
    }
    points.sort((a, b) => a.timestamp.compareTo(b.timestamp));
    return List.unmodifiable(points);
  }

  static List<List<String>> _parseCsv(String input) {
    final rows = <List<String>>[];
    var row = <String>[];
    final field = StringBuffer();
    var quoted = false;

    for (var i = 0; i < input.length; i++) {
      final char = input[i];
      if (char == '"') {
        if (quoted && i + 1 < input.length && input[i + 1] == '"') {
          field.write('"');
          i++;
        } else {
          quoted = !quoted;
        }
      } else if (char == ',' && !quoted) {
        row.add(field.toString());
        field.clear();
      } else if ((char == '\n' || char == '\r') && !quoted) {
        if (char == '\r' && i + 1 < input.length && input[i + 1] == '\n') {
          i++;
        }
        row.add(field.toString());
        field.clear();
        rows.add(row);
        row = <String>[];
      } else {
        field.write(char);
      }
    }

    if (field.length > 0 || row.isNotEmpty) {
      row.add(field.toString());
      rows.add(row);
    }
    if (rows.isNotEmpty && rows.first.isNotEmpty) {
      rows.first[0] = rows.first[0].replaceFirst('\uFEFF', '');
    }
    return rows;
  }
}
